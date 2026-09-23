import "./helpers-preload";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createBuyer, updateBuyer } from "@/lib/buyers";
import { listBuyerHistory } from "@/lib/buyer-history";
import {
  createBuyerInterest,
  BuyerInterestError,
  transitionBuyerInterest,
} from "@/lib/buyer-interests";
import { canTransitionBuyerInterest } from "@/lib/buyer-interest-fsm";
import {
  createDeposit,
  DepositError,
  payDeposit,
} from "@/lib/deposits";
import { prisma } from "@/lib/prisma";
import { completePurchase, PurchaseError } from "@/lib/purchase";
import { createSaleListing, updateSaleListing } from "@/lib/sale-listings";
import {
  completeViewing,
  scheduleViewing,
  ViewingError,
} from "@/lib/viewings";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";

async function setupListing() {
  const { property } = await resetFixtures();
  const listing = await createSaleListing({ propertyId: property.id });
  await updateSaleListing(listing.listing.id, { status: "ACTIVE", price: 7_500_000 });
  return { property, listing: listing.listing };
}

async function bringToDepositPaid(buyerInterestId: string, amount = 500_000) {
  const viewing = await scheduleViewing(buyerInterestId, {
    scheduledAt: "2026-11-01T10:00:00.000Z",
  });
  await completeViewing(viewing.id);
  const deposit = await createDeposit(buyerInterestId, { amount });
  await payDeposit(deposit.id);
  return deposit;
}

describe("sales purchase and buyer history", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  it("пишет историю при создании покупателя", async () => {
    await resetFixtures();
    const buyer = await createBuyer({ name: "History Buyer" });
    const history = await listBuyerHistory(buyer.id);
    assert.ok(history.some((entry) => entry.type === "BUYER_CREATED"));
  });

  it("пишет историю при создании BuyerInterest", async () => {
    const { listing } = await setupListing();
    const buyer = await createBuyer({ name: "Interest Buyer" });
    const { interest } = await createBuyerInterest({
      buyerId: buyer.id,
      saleListingId: listing.id,
    });
    const history = await listBuyerHistory(buyer.id);
    assert.ok(
      history.some(
        (entry) =>
          entry.type === "INTEREST_ADDED" && entry.buyerInterestId === interest.id,
      ),
    );
  });

  it("пишет историю просмотра: scheduled/completed", async () => {
    const { listing } = await setupListing();
    const buyer = await createBuyer({ name: "View Buyer" });
    const { interest } = await createBuyerInterest({
      buyerId: buyer.id,
      saleListingId: listing.id,
    });
    const viewing = await scheduleViewing(interest.id, {
      scheduledAt: "2026-11-02T12:00:00.000Z",
    });
    await completeViewing(viewing.id);
    const history = await listBuyerHistory(buyer.id);
    assert.ok(history.some((entry) => entry.type === "VIEWING_SCHEDULED"));
    assert.ok(history.some((entry) => entry.type === "VIEWING_COMPLETED"));
  });

  it("пишет историю задатка: create/pay", async () => {
    const { listing } = await setupListing();
    const buyer = await createBuyer({ name: "Deposit Buyer" });
    const { interest } = await createBuyerInterest({
      buyerId: buyer.id,
      saleListingId: listing.id,
    });
    await bringToDepositPaid(interest.id, 250_000);
    const history = await listBuyerHistory(buyer.id);
    assert.ok(history.some((entry) => entry.type === "DEPOSIT_CREATED"));
    assert.ok(
      history.some(
        (entry) =>
          entry.type === "DEPOSIT_PAID" &&
          entry.message?.includes("250000"),
      ),
    );
  });

  it("история append-only и читается newest-first", async () => {
    await resetFixtures();
    const buyer = await createBuyer({ name: "Order Buyer" });
    await updateBuyer(buyer.id, { notes: "upd" });
    const history = await listBuyerHistory(buyer.id);
    assert.ok(history.length >= 2);
    for (let i = 1; i < history.length; i += 1) {
      assert.ok(history[i - 1].createdAt >= history[i].createdAt);
    }
  });

  it("покупка требует DEPOSIT_PAID", async () => {
    const { listing } = await setupListing();
    const buyer = await createBuyer({ name: "Early Buyer" });
    const { interest } = await createBuyerInterest({
      buyerId: buyer.id,
      saleListingId: listing.id,
    });
    await assert.rejects(
      () => completePurchase(interest.id),
      (error: unknown) => error instanceof PurchaseError && error.code === "VALIDATION",
    );
  });

  it("валидная покупка → PURCHASED + SOLD + история атомарно", async () => {
    const { listing } = await setupListing();
    const buyer = await createBuyer({ name: "Winner" });
    const { interest } = await createBuyerInterest({
      buyerId: buyer.id,
      saleListingId: listing.id,
    });
    await bringToDepositPaid(interest.id);

    const result = await completePurchase(interest.id);
    assert.equal(result.created, true);
    assert.equal(result.interest.status, "PURCHASED");
    assert.equal(result.listing.status, "SOLD");

    const refreshedInterest = await prisma.buyerInterest.findUniqueOrThrow({
      where: { id: interest.id },
    });
    const refreshedListing = await prisma.saleListing.findUniqueOrThrow({
      where: { id: listing.id },
    });
    assert.equal(refreshedInterest.status, "PURCHASED");
    assert.equal(refreshedListing.status, "SOLD");

    const history = await listBuyerHistory(buyer.id);
    assert.equal(
      history.filter((entry) => entry.type === "PURCHASE_COMPLETED").length,
      1,
    );
  });

  it("остальные активные интересы → REFUSED с историей, не удаляются", async () => {
    const { listing } = await setupListing();
    const winner = await createBuyer({ name: "Winner 2" });
    const loser = await createBuyer({ name: "Loser" });
    const { interest: winnerInterest } = await createBuyerInterest({
      buyerId: winner.id,
      saleListingId: listing.id,
    });
    const { interest: loserInterest } = await createBuyerInterest({
      buyerId: loser.id,
      saleListingId: listing.id,
    });
    await bringToDepositPaid(winnerInterest.id);

    await completePurchase(winnerInterest.id);

    const loserRefreshed = await prisma.buyerInterest.findUniqueOrThrow({
      where: { id: loserInterest.id },
    });
    assert.equal(loserRefreshed.status, "REFUSED");

    const count = await prisma.buyerInterest.count({
      where: { saleListingId: listing.id },
    });
    assert.equal(count, 2);

    const loserHistory = await listBuyerHistory(loser.id);
    assert.ok(
      loserHistory.some(
        (entry) =>
          entry.type === "REFUSED" &&
          entry.message === "Объект продан другому покупателю",
      ),
    );
  });

  it("второй покупатель не может купить SOLD → 409", async () => {
    const { listing } = await setupListing();
    const a = await createBuyer({ name: "A" });
    const b = await createBuyer({ name: "B" });
    const { interest: interestA } = await createBuyerInterest({
      buyerId: a.id,
      saleListingId: listing.id,
    });
    const { interest: interestB } = await createBuyerInterest({
      buyerId: b.id,
      saleListingId: listing.id,
    });
    await bringToDepositPaid(interestA.id);
    await completePurchase(interestA.id);

    // Simulate concurrent late purchase attempt after listing is already SOLD.
    await prisma.buyerInterest.update({
      where: { id: interestB.id },
      data: { status: "DEPOSIT_PAID" },
    });

    await assert.rejects(
      () => completePurchase(interestB.id),
      (error: unknown) =>
        error instanceof PurchaseError &&
        error.code === "CONFLICT" &&
        error.machineCode === "SALE_LISTING_ALREADY_SOLD",
    );
  });

  it("повторная покупка победителя идемпотентна без дубля истории", async () => {
    const { listing } = await setupListing();
    const buyer = await createBuyer({ name: "Idempotent" });
    const { interest } = await createBuyerInterest({
      buyerId: buyer.id,
      saleListingId: listing.id,
    });
    await bringToDepositPaid(interest.id);
    await completePurchase(interest.id);
    const second = await completePurchase(interest.id);
    assert.equal(second.created, false);
    assert.equal(second.interest.status, "PURCHASED");
    const history = await listBuyerHistory(buyer.id);
    assert.equal(
      history.filter((entry) => entry.type === "PURCHASE_COMPLETED").length,
      1,
    );
  });

  it("после SOLD блокируются interest / viewing / deposit / pay", async () => {
    const { listing } = await setupListing();
    const winner = await createBuyer({ name: "Sold Winner" });
    const outsider = await createBuyer({ name: "Outsider" });
    const loser = await createBuyer({ name: "Pending Loser" });
    const { interest } = await createBuyerInterest({
      buyerId: winner.id,
      saleListingId: listing.id,
    });
    const { interest: loserInterest } = await createBuyerInterest({
      buyerId: loser.id,
      saleListingId: listing.id,
    });
    const pendingDeposit = await createDeposit(loserInterest.id, { amount: 10_000 });
    await bringToDepositPaid(interest.id);
    await completePurchase(interest.id);

    await assert.rejects(
      () =>
        createBuyerInterest({
          buyerId: outsider.id,
          saleListingId: listing.id,
        }),
      (error: unknown) =>
        error instanceof BuyerInterestError &&
        error.code === "CONFLICT" &&
        error.machineCode === "SALE_LISTING_ALREADY_SOLD",
    );

    await assert.rejects(
      () =>
        scheduleViewing(interest.id, {
          scheduledAt: "2026-12-01T10:00:00.000Z",
        }),
      (error: unknown) =>
        error instanceof ViewingError &&
        error.machineCode === "SALE_LISTING_ALREADY_SOLD",
    );

    await assert.rejects(
      () => createDeposit(interest.id, { amount: 1000 }),
      (error: unknown) =>
        error instanceof DepositError &&
        error.machineCode === "SALE_LISTING_ALREADY_SOLD",
    );

    await assert.rejects(
      () => payDeposit(pendingDeposit.id),
      (error: unknown) =>
        error instanceof DepositError &&
        error.machineCode === "SALE_LISTING_ALREADY_SOLD",
    );
  });

  it("PURCHASED и REFUSED терминальны", async () => {
    assert.equal(canTransitionBuyerInterest("PURCHASED", "REFUSED"), false);
    assert.equal(canTransitionBuyerInterest("REFUSED", "INTERESTED"), false);
    assert.equal(canTransitionBuyerInterest("REFUSED", "PURCHASED"), false);

    const { listing } = await setupListing();
    const buyer = await createBuyer({ name: "Terminal" });
    const { interest } = await createBuyerInterest({
      buyerId: buyer.id,
      saleListingId: listing.id,
    });
    await transitionBuyerInterest(interest.id, "REFUSED");
    await assert.rejects(
      () => transitionBuyerInterest(interest.id, "THINKING"),
      (error: unknown) => error instanceof BuyerInterestError,
    );
  });
});
