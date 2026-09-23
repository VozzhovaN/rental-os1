import "./helpers-preload";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
  createLongTermListing,
  getLongTermListingByPropertyId,
} from "@/lib/long-term-listings";
import { prisma } from "@/lib/prisma";
import { createPropertyPhoto } from "@/lib/property-photos";
import {
  archiveSaleListing,
  createSaleListing,
  getSaleListingById,
  replaceSaleListingPhotos,
  SaleListingError,
  updateSaleListing,
} from "@/lib/sale-listings";
import {
  parseUpdateSaleListing,
  SALE_LISTING_WRITABLE_STATUSES,
  updateSaleListingSchema,
} from "@/lib/validations/sale-listing";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";

describe("sale listings", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  it("один Property → максимум один SaleListing", async () => {
    const { property } = await resetFixtures();
    const first = await createSaleListing({ propertyId: property.id });
    assert.equal(first.created, true);
    assert.equal(await prisma.saleListing.count({ where: { propertyId: property.id } }), 1);
  });

  it("повторный create не создаёт дубль", async () => {
    const { property } = await resetFixtures();
    const first = await createSaleListing({ propertyId: property.id });
    const second = await createSaleListing({ propertyId: property.id });
    assert.equal(second.created, false);
    assert.equal(second.listing.id, first.listing.id);
    assert.equal(await prisma.saleListing.count(), 1);
  });

  it("SaleListing независим от LongTermListing", async () => {
    const { property } = await resetFixtures();
    const longTerm = await createLongTermListing({ propertyId: property.id });
    const sale = await createSaleListing({ propertyId: property.id });
    assert.equal(longTerm.created, true);
    assert.equal(sale.created, true);
    assert.notEqual(longTerm.listing.id, sale.listing.id);

    await updateSaleListing(sale.listing.id, { price: 9_000_000, status: "ACTIVE" });
    const longTermAfter = await getLongTermListingByPropertyId(property.id);
    assert.equal(longTermAfter?.monthlyPrice, 0);
    assert.equal(longTermAfter?.status, "DRAFT");

    await updateLongTermPrice(longTerm.listing.id);
    const saleAfter = await getSaleListingById(sale.listing.id);
    assert.equal(saleAfter?.price, 9_000_000);
    assert.equal(saleAfter?.status, "ACTIVE");
  });

  it("ACTIVE требует price > 0", async () => {
    const { property } = await resetFixtures();
    const created = await createSaleListing({ propertyId: property.id });
    assert.equal(created.listing.price, 0);

    await assert.rejects(
      () => updateSaleListing(created.listing.id, { status: "ACTIVE" }),
      (error: unknown) =>
        error instanceof SaleListingError &&
        error.code === "VALIDATION" &&
        error.message === "Для статуса ACTIVE цена должна быть больше 0",
    );

    const activated = await updateSaleListing(created.listing.id, {
      status: "ACTIVE",
      price: 5_500_000,
    });
    assert.equal(activated.status, "ACTIVE");
    assert.equal(activated.price, 5_500_000);

    await assert.rejects(
      () => updateSaleListing(created.listing.id, { price: 0 }),
      (error: unknown) =>
        error instanceof SaleListingError && error.code === "VALIDATION",
    );
  });

  it("propertyId нельзя менять через PATCH / Zod", () => {
    const parsed = parseUpdateSaleListing({ propertyId: "hack", price: 1 });
    assert.equal(parsed.success, false);
    assert.equal(updateSaleListingSchema.safeParse({ propertyId: "hack" }).success, false);
    assert.equal(updateSaleListingSchema.safeParse({ price: 100 }).success, true);
  });

  it("archive переводит в ARCHIVED без hard delete", async () => {
    const { property } = await resetFixtures();
    const created = await createSaleListing({ propertyId: property.id });
    const archived = await archiveSaleListing(created.listing.id);
    assert.equal(archived.status, "ARCHIVED");
    assert.equal(await prisma.saleListing.count({ where: { id: created.listing.id } }), 1);
    assert.equal(await prisma.property.count({ where: { id: property.id } }), 1);

    await assert.rejects(
      () => updateSaleListing(created.listing.id, { status: "ACTIVE", price: 1 }),
      (error: unknown) =>
        error instanceof SaleListingError &&
        error.message === "Архивная карточка не может быть восстановлена",
    );
  });

  it("SaleListingPhoto использует PropertyPhoto и сохраняет порядок", async () => {
    const { property } = await resetFixtures();
    const created = await createSaleListing({ propertyId: property.id });
    const first = await createPropertyPhoto(property.id, { url: "https://example.com/sale-a.jpg" });
    const second = await createPropertyPhoto(property.id, { url: "https://example.com/sale-b.jpg" });

    const listing = await replaceSaleListingPhotos(created.listing.id, {
      items: [
        { photoId: second.id, order: 0 },
        { photoId: first.id, order: 1 },
      ],
    });

    assert.equal(listing?.photos.length, 2);
    assert.equal(listing?.photos[0].propertyPhotoId, second.id);
    assert.equal(listing?.photos[0].order, 0);
    assert.equal(listing?.photos[1].propertyPhotoId, first.id);
    assert.equal(listing?.photos[1].order, 1);
    assert.equal(await prisma.propertyPhoto.count({ where: { id: first.id } }), 1);
    assert.equal(await prisma.propertyPhoto.count({ where: { id: second.id } }), 1);
  });

  it("фото другого Property отклоняется", async () => {
    const { property } = await resetFixtures();
    const other = await prisma.property.create({
      data: {
        name: "Чужой объект",
        slug: `other-${Date.now()}`,
        type: "APARTMENT",
        status: "ACTIVE",
        address: "ул. Другая, 1",
        city: "Город",
        district: "Р",
        area: 30,
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

    const created = await createSaleListing({ propertyId: property.id });
    const foreignPhoto = await createPropertyPhoto(other.id, {
      url: "https://example.com/foreign.jpg",
    });

    await assert.rejects(
      () =>
        replaceSaleListingPhotos(created.listing.id, {
          items: [{ photoId: foreignPhoto.id, order: 0 }],
        }),
      (error: unknown) =>
        error instanceof SaleListingError &&
        error.code === "VALIDATION" &&
        error.message === "Можно выбирать только фотографии этого объекта",
    );
  });

  it("дубликат фото в payload отклоняется", async () => {
    const { property } = await resetFixtures();
    const created = await createSaleListing({ propertyId: property.id });
    const photo = await createPropertyPhoto(property.id, { url: "https://example.com/dup.jpg" });

    await assert.rejects(
      () =>
        replaceSaleListingPhotos(created.listing.id, {
          items: [
            { photoId: photo.id, order: 0 },
            { photoId: photo.id, order: 1 },
          ],
        }),
      (error: unknown) =>
        error instanceof SaleListingError &&
        error.message === "Фотография не может быть добавлена дважды",
    );
  });

  it("SOLD не доступен через обычный writable PATCH schema", () => {
    assert.equal((SALE_LISTING_WRITABLE_STATUSES as readonly string[]).includes("SOLD"), false);
    assert.equal(updateSaleListingSchema.safeParse({ status: "SOLD" }).success, false);
    assert.equal(updateSaleListingSchema.safeParse({ status: "ACTIVE" }).success, true);
    assert.equal(updateSaleListingSchema.safeParse({ status: "DRAFT" }).success, true);
    assert.equal(updateSaleListingSchema.safeParse({ status: "PAUSED" }).success, true);
    assert.equal(updateSaleListingSchema.safeParse({ status: "ARCHIVED" }).success, true);
  });

  it("strict schema отклоняет mass assignment", () => {
    assert.equal(
      updateSaleListingSchema.safeParse({
        price: 1,
        unknownField: "x",
        propertyId: "nope",
      }).success,
      false,
    );
  });
});

async function updateLongTermPrice(listingId: string) {
  await prisma.longTermListing.update({
    where: { id: listingId },
    data: { monthlyPrice: 77777 },
  });
}
