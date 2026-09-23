import "./helpers-preload";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createBuyer } from "@/lib/buyers";
import { createBuyerInterest } from "@/lib/buyer-interests";
import {
  createDeposit,
  DepositError,
  forfeitDeposit,
  payDeposit,
  refundDeposit,
} from "@/lib/deposits";
import { prisma } from "@/lib/prisma";
import { createSaleListing, updateSaleListing } from "@/lib/sale-listings";
import {
  createDepositSchema,
  createViewingSchema,
} from "@/lib/validations/viewing-deposit";
import { updateBuyerInterestSchema } from "@/lib/validations/buyer";
import {
  cancelViewing,
  completeViewing,
  markViewingNoShow,
  scheduleViewing,
  ViewingError,
} from "@/lib/viewings";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";

async function setupInterest() {
  const { property } = await resetFixtures();
  const listing = await createSaleListing({ propertyId: property.id });
  await updateSaleListing(listing.listing.id, { status: "ACTIVE", price: 5_000_000 });
  const buyer = await createBuyer({ name: "Viewer" });
  const interest = await createBuyerInterest({
    buyerId: buyer.id,
    saleListingId: listing.listing.id,
  });
  return { property, listing: listing.listing, buyer, interest: interest.interest };
}

describe("sales viewings and deposits", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  it("назначает показ и ставит BuyerInterest VIEWING_SCHEDULED", async () => {
    const { interest } = await setupInterest();
    const viewing = await scheduleViewing(interest.id, {
      scheduledAt: "2026-10-01T12:00:00.000Z",
      notes: "утро",
    });
    assert.equal(viewing.status, "SCHEDULED");
    const refreshed = await prisma.buyerInterest.findUniqueOrThrow({
      where: { id: interest.id },
    });
    assert.equal(refreshed.status, "VIEWING_SCHEDULED");
  });

  it("complete → Viewing COMPLETED + BuyerInterest VIEWING_COMPLETED", async () => {
    const { interest } = await setupInterest();
    const viewing = await scheduleViewing(interest.id, {
      scheduledAt: "2026-10-02T12:00:00.000Z",
    });
    const completed = await completeViewing(viewing.id);
    assert.equal(completed.status, "COMPLETED");
    const refreshed = await prisma.buyerInterest.findUniqueOrThrow({
      where: { id: interest.id },
    });
    assert.equal(refreshed.status, "VIEWING_COMPLETED");
  });

  it("cancel и no-show не ставят REFUSED; новый показ возможен", async () => {
    const { interest } = await setupInterest();
    const first = await scheduleViewing(interest.id, {
      scheduledAt: "2026-10-03T12:00:00.000Z",
    });
    const cancelled = await cancelViewing(first.id);
    assert.equal(cancelled.status, "CANCELLED");
    let refreshed = await prisma.buyerInterest.findUniqueOrThrow({
      where: { id: interest.id },
    });
    assert.notEqual(refreshed.status, "REFUSED");

    const second = await scheduleViewing(interest.id, {
      scheduledAt: "2026-10-04T12:00:00.000Z",
    });
    const noShow = await markViewingNoShow(second.id);
    assert.equal(noShow.status, "NO_SHOW");
    refreshed = await prisma.buyerInterest.findUniqueOrThrow({ where: { id: interest.id } });
    assert.notEqual(refreshed.status, "REFUSED");

    const third = await scheduleViewing(interest.id, {
      scheduledAt: "2026-10-05T12:00:00.000Z",
    });
    assert.equal(third.status, "SCHEDULED");
  });

  it("терминальный viewing нельзя перевести снова", async () => {
    const { interest } = await setupInterest();
    const viewing = await scheduleViewing(interest.id, {
      scheduledAt: "2026-10-06T12:00:00.000Z",
    });
    await completeViewing(viewing.id);
    await assert.rejects(
      () => cancelViewing(viewing.id),
      (error: unknown) => error instanceof ViewingError && error.code === "VALIDATION",
    );
  });

  it("создаёт PENDING deposit amount > 0; pay ставит DEPOSIT_PAID", async () => {
    const { interest } = await setupInterest();
    assert.equal(createDepositSchema.safeParse({ amount: 0 }).success, false);
    const deposit = await createDeposit(interest.id, { amount: 150000, notes: "задаток" });
    assert.equal(deposit.status, "PENDING");

    await scheduleViewing(interest.id, { scheduledAt: "2026-10-07T12:00:00.000Z" });
    const viewing = await prisma.viewing.findFirstOrThrow({
      where: { buyerInterestId: interest.id },
    });
    await completeViewing(viewing.id);

    const paid = await payDeposit(deposit.id);
    assert.equal(paid.status, "PAID");
    assert.ok(paid.paidAt);
    const refreshed = await prisma.buyerInterest.findUniqueOrThrow({
      where: { id: interest.id },
    });
    assert.equal(refreshed.status, "DEPOSIT_PAID");
  });

  it("второй активный PAID deposit на SaleListing → 409", async () => {
    const { property, listing } = await setupInterest();
    const buyerA = await createBuyer({ name: "A" });
    const buyerB = await createBuyer({ name: "B" });
    const interestA = await createBuyerInterest({
      buyerId: buyerA.id,
      saleListingId: listing.id,
    });
    const interestB = await createBuyerInterest({
      buyerId: buyerB.id,
      saleListingId: listing.id,
    });

    // Move interests to a state that allows DEPOSIT_PAID
    await prisma.buyerInterest.update({
      where: { id: interestA.interest.id },
      data: { status: "VIEWING_COMPLETED" },
    });
    await prisma.buyerInterest.update({
      where: { id: interestB.interest.id },
      data: { status: "THINKING" },
    });

    const depositA = await createDeposit(interestA.interest.id, { amount: 100000 });
    const depositB = await createDeposit(interestB.interest.id, { amount: 120000 });
    await payDeposit(depositA.id);

    await assert.rejects(
      () => payDeposit(depositB.id),
      (error: unknown) =>
        error instanceof DepositError &&
        error.code === "CONFLICT" &&
        error.machineCode === "SALE_LISTING_ALREADY_HAS_PAID_DEPOSIT",
    );
    void property;
  });

  it("refund/forfeit из PAID без PURCHASED; interest status не ломается", async () => {
    const { interest } = await setupInterest();
    await prisma.buyerInterest.update({
      where: { id: interest.id },
      data: { status: "THINKING" },
    });
    const deposit = await createDeposit(interest.id, { amount: 90000 });
    await payDeposit(deposit.id);
    const before = await prisma.buyerInterest.findUniqueOrThrow({ where: { id: interest.id } });
    assert.equal(before.status, "DEPOSIT_PAID");

    const refunded = await refundDeposit(deposit.id);
    assert.equal(refunded.status, "REFUNDED");
    const afterRefund = await prisma.buyerInterest.findUniqueOrThrow({
      where: { id: interest.id },
    });
    assert.equal(afterRefund.status, "DEPOSIT_PAID");
    assert.notEqual(afterRefund.status, "PURCHASED");
    assert.notEqual(afterRefund.status, "REFUSED");

    const deposit2 = await createDeposit(interest.id, { amount: 80000 });
    // Clear PAID conflict by already refunded; pay second
    await payDeposit(deposit2.id);
    const forfeited = await forfeitDeposit(deposit2.id);
    assert.equal(forfeited.status, "FORFEITED");
  });

  it("buyerInterestId immutable; arbitrary status blocked; workflow statuses not manual", () => {
    assert.equal(
      createViewingSchema.safeParse({ scheduledAt: "bad", buyerInterestId: "x" }).success,
      false,
    );
    assert.equal(
      createDepositSchema.safeParse({ amount: 10, buyerInterestId: "x" }).success,
      false,
    );
    assert.equal(updateBuyerInterestSchema.safeParse({ status: "VIEWING_SCHEDULED" }).success, false);
    assert.equal(updateBuyerInterestSchema.safeParse({ status: "VIEWING_COMPLETED" }).success, false);
    assert.equal(updateBuyerInterestSchema.safeParse({ status: "DEPOSIT_PAID" }).success, false);
    assert.equal(updateBuyerInterestSchema.safeParse({ status: "PURCHASED" }).success, false);
  });
});
