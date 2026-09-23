import "./helpers-preload";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
  canTransitionBuyerInterest,
} from "@/lib/buyer-interest-fsm";
import {
  createBuyerInterest,
  BuyerInterestError,
  transitionBuyerInterest,
  updateBuyerInterest,
} from "@/lib/buyer-interests";
import { createBuyer, getBuyers, updateBuyer, BuyerError } from "@/lib/buyers";
import { prisma } from "@/lib/prisma";
import { createSaleListing, updateSaleListing } from "@/lib/sale-listings";
import {
  createBuyerSchema,
  updateBuyerInterestSchema,
  updateBuyerSchema,
} from "@/lib/validations/buyer";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";

describe("buyers and buyer interests", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  it("создаёт и обновляет Buyer", async () => {
    await resetFixtures();
    const created = await createBuyer({
      name: "Анна Покупатель",
      phone: "+7 900 111-22-33",
      email: "anna@example.test",
      messengerType: "TELEGRAM",
      messengerContact: "@anna",
      notes: "Заметка",
    });
    assert.equal(created.name, "Анна Покупатель");
    const updated = await updateBuyer(created.id, { name: "Анна П.", notes: null });
    assert.equal(updated.name, "Анна П.");
    assert.equal(updated.notes, null);
  });

  it("ищет Buyer по имени/телефону/email", async () => {
    await resetFixtures();
    await createBuyer({
      name: "Игорь Тестов",
      phone: "+7 900 999-88-77",
      email: "igor@search.test",
    });
    const byName = await getBuyers({ q: "Игорь" });
    assert.equal(byName.length, 1);
    const byPhone = await getBuyers({ q: "999-88" });
    assert.equal(byPhone.length, 1);
    const byEmail = await getBuyers({ q: "igor@search" });
    assert.equal(byEmail.length, 1);
  });

  it("отклоняет невалидный email", () => {
    assert.equal(createBuyerSchema.safeParse({ name: "X", email: "bad" }).success, false);
    assert.equal(createBuyerSchema.safeParse({ name: "X", email: "ok@test.com" }).success, true);
  });

  it("Buyer может иметь несколько SaleListing; SaleListing — нескольких Buyers", async () => {
    const { property } = await resetFixtures();
    const other = await prisma.property.create({
      data: {
        name: "Второй объект",
        slug: `sale-2-${Date.now()}`,
        type: "APARTMENT",
        status: "ACTIVE",
        address: "ул. 2",
        city: "Город",
        district: "Р",
        area: 40,
        rooms: 1,
        bedrooms: 1,
        bathrooms: 1,
        guests: 2,
        description: "x",
        shortDescription: "x",
        ownerName: "O",
        ownerPhone: "+7",
        managementType: "OWN",
      },
    });
    const listingA = await createSaleListing({ propertyId: property.id });
    const listingB = await createSaleListing({ propertyId: other.id });
    await updateSaleListing(listingA.listing.id, { status: "ACTIVE", price: 1_000_000 });
    await updateSaleListing(listingB.listing.id, { status: "ACTIVE", price: 2_000_000 });

    const buyerA = await createBuyer({ name: "Buyer A" });
    const buyerB = await createBuyer({ name: "Buyer B" });

    await createBuyerInterest({ buyerId: buyerA.id, saleListingId: listingA.listing.id });
    await createBuyerInterest({ buyerId: buyerA.id, saleListingId: listingB.listing.id });
    await createBuyerInterest({ buyerId: buyerB.id, saleListingId: listingA.listing.id });

    assert.equal(await prisma.buyerInterest.count({ where: { buyerId: buyerA.id } }), 2);
    assert.equal(
      await prisma.buyerInterest.count({ where: { saleListingId: listingA.listing.id } }),
      2,
    );
  });

  it("повторный интерес идемпотентен", async () => {
    const { property } = await resetFixtures();
    const listing = await createSaleListing({ propertyId: property.id });
    await updateSaleListing(listing.listing.id, { status: "ACTIVE", price: 100 });
    const buyer = await createBuyer({ name: "Dup" });
    const first = await createBuyerInterest({
      buyerId: buyer.id,
      saleListingId: listing.listing.id,
    });
    const second = await createBuyerInterest({
      buyerId: buyer.id,
      saleListingId: listing.listing.id,
    });
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.interest.id, first.interest.id);
    assert.equal(await prisma.buyerInterest.count(), 1);
  });

  it("отклоняет интерес к SOLD/ARCHIVED", async () => {
    const { property } = await resetFixtures();
    const listing = await createSaleListing({ propertyId: property.id });
    await updateSaleListing(listing.listing.id, { status: "ACTIVE", price: 100 });
    const buyer = await createBuyer({ name: "X" });

    await prisma.saleListing.update({
      where: { id: listing.listing.id },
      data: { status: "SOLD" },
    });
    await assert.rejects(
      () => createBuyerInterest({ buyerId: buyer.id, saleListingId: listing.listing.id }),
      (error: unknown) =>
        error instanceof BuyerInterestError &&
        error.code === "CONFLICT" &&
        error.machineCode === "SALE_LISTING_ALREADY_SOLD",
    );

    await prisma.saleListing.update({
      where: { id: listing.listing.id },
      data: { status: "ARCHIVED" },
    });
    await assert.rejects(
      () => createBuyerInterest({ buyerId: buyer.id, saleListingId: listing.listing.id }),
      (error: unknown) => error instanceof BuyerInterestError && error.code === "VALIDATION",
    );
  });

  it("buyerId/saleListingId immutable через schema", () => {
    assert.equal(
      updateBuyerInterestSchema.safeParse({ buyerId: "x", saleListingId: "y" }).success,
      false,
    );
    assert.equal(updateBuyerSchema.safeParse({ id: "hack" }).success, false);
  });

  it("валидный FSM transition и отказ в invalid", async () => {
    const { property } = await resetFixtures();
    const listing = await createSaleListing({ propertyId: property.id });
    await updateSaleListing(listing.listing.id, { status: "ACTIVE", price: 100 });
    const buyer = await createBuyer({ name: "FSM" });
    const created = await createBuyerInterest({
      buyerId: buyer.id,
      saleListingId: listing.listing.id,
    });

    assert.equal(canTransitionBuyerInterest("INTERESTED", "VIEWING_REQUESTED"), true);
    const next = await transitionBuyerInterest(created.interest.id, "VIEWING_REQUESTED");
    assert.equal(next.status, "VIEWING_REQUESTED");

    assert.equal(canTransitionBuyerInterest("VIEWING_REQUESTED", "THINKING"), false);
    await assert.rejects(
      () => transitionBuyerInterest(created.interest.id, "THINKING"),
      (error: unknown) => error instanceof BuyerInterestError && error.code === "VALIDATION",
    );
  });

  it("PURCHASED и REFUSED терминальны; manual PATCH не ставит PURCHASED", async () => {
    const { property } = await resetFixtures();
    const listing = await createSaleListing({ propertyId: property.id });
    await updateSaleListing(listing.listing.id, { status: "ACTIVE", price: 100 });
    const buyer = await createBuyer({ name: "Terminal" });
    const created = await createBuyerInterest({
      buyerId: buyer.id,
      saleListingId: listing.listing.id,
    });

    assert.equal(updateBuyerInterestSchema.safeParse({ status: "PURCHASED" }).success, false);
    assert.equal(updateBuyerInterestSchema.safeParse({ status: "DEPOSIT_PAID" }).success, false);
    assert.equal(
      updateBuyerInterestSchema.safeParse({ status: "VIEWING_COMPLETED" }).success,
      false,
    );

    await assert.rejects(
      () => transitionBuyerInterest(created.interest.id, "PURCHASED"),
      (error: unknown) => error instanceof BuyerInterestError && error.code === "VALIDATION",
    );

    const refused = await updateBuyerInterest(created.interest.id, { status: "REFUSED" });
    assert.equal(refused.status, "REFUSED");
    await assert.rejects(
      () => transitionBuyerInterest(created.interest.id, "INTERESTED"),
      (error: unknown) => error instanceof BuyerInterestError && error.code === "VALIDATION",
    );

    // Internal workflow path can reach PURCHASED for later stages.
    const second = await createBuyer({ name: "Workflow" });
    const interest2 = await createBuyerInterest({
      buyerId: second.id,
      saleListingId: listing.listing.id,
    });
    await transitionBuyerInterest(interest2.interest.id, "VIEWING_SCHEDULED", {
      allowWorkflowStatuses: true,
    });
    await transitionBuyerInterest(interest2.interest.id, "VIEWING_COMPLETED", {
      allowWorkflowStatuses: true,
    });
    await transitionBuyerInterest(interest2.interest.id, "DEPOSIT_PAID", {
      allowWorkflowStatuses: true,
    });
    const purchased = await transitionBuyerInterest(interest2.interest.id, "PURCHASED", {
      allowWorkflowStatuses: true,
    });
    assert.equal(purchased.status, "PURCHASED");
    await assert.rejects(
      () =>
        transitionBuyerInterest(interest2.interest.id, "REFUSED", {
          allowWorkflowStatuses: true,
        }),
      (error: unknown) => error instanceof BuyerInterestError,
    );
  });

  it("strict mutation schema и отсутствие mass assignment", () => {
    assert.equal(
      createBuyerSchema.safeParse({ name: "A", unknown: true }).success,
      false,
    );
    assert.equal(
      updateBuyerInterestSchema.safeParse({ notes: "ok", buyerId: "nope" }).success,
      false,
    );
  });

  it("update несуществующего Buyer → NOT_FOUND", async () => {
    await assert.rejects(
      () => updateBuyer("missing", { name: "X" }),
      (error: unknown) => error instanceof BuyerError && error.code === "NOT_FOUND",
    );
  });
});
