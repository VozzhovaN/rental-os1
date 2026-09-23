import "./helpers-preload";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createBuyer } from "@/lib/buyers";
import { createBuyerInterest } from "@/lib/buyer-interests";
import { createDeposit } from "@/lib/deposits";
import { prisma } from "@/lib/prisma";
import { createPropertyPhoto } from "@/lib/property-photos";
import {
  buildCianSaleListingPreview,
  buildPublicCianSaleFeed,
  hashCianSalePayload,
  isIncludedInCianSaleFeed,
  mapToCianSalePayload,
  prepareCianSaleFeedItems,
  prepareCianSalePublication,
  serializeCianSaleFeed,
  validateCianSalePublication,
} from "@/lib/publications/providers/cian/sale";
import {
  createSalePublication,
  toSalePublicationListingSource,
} from "@/lib/sale-publications";
import {
  createSaleListing,
  replaceSaleListingPhotos,
  updateSaleListing,
} from "@/lib/sale-listings";
import { scheduleViewing } from "@/lib/viewings";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";

async function createReadySaleListing(options: { type?: "APARTMENT" | "STUDIO" | "HOUSE" } = {}) {
  const { property } = await resetFixtures();
  const type = options.type ?? "APARTMENT";
  await prisma.property.update({
    where: { id: property.id },
    data: {
      type,
      floor: type === "HOUSE" ? null : 3,
      totalFloors: type === "HOUSE" ? null : 9,
      rooms: type === "STUDIO" ? 0 : 2,
      area: 54,
    },
  });
  const cian = await prisma.salesChannel.create({
    data: { code: "CIAN", name: "ЦИАН", isActive: true },
  });
  const created = await createSaleListing({ propertyId: property.id });
  const listing = await updateSaleListing(created.listing.id, {
    status: "ACTIVE",
    price: 12_500_000,
    marketingTitle: "Продажа тест",
    description: "Достаточно длинное описание продажи для CIAN XML фида квартиры.",
    publicationContactName: "Анна",
    publicationPhoneCountryCode: "7",
    publicationPhoneNumber: "9001234567",
  });
  const first = await createPropertyPhoto(property.id, {
    url: "https://cdn.example.com/sale-1.jpg",
  });
  const second = await createPropertyPhoto(property.id, {
    url: "https://cdn.example.com/sale-2.jpg",
  });
  const withPhotos = await replaceSaleListingPhotos(listing.id, {
    items: [
      { photoId: second.id, order: 0 },
      { photoId: first.id, order: 1 },
    ],
  });
  return { property, cian, listing: withPhotos!, first, second };
}

describe("cian sale xml feed", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  it("supported apartment maps to CIAN flatSale payload", async () => {
    const { listing } = await createReadySaleListing();
    const source = toSalePublicationListingSource(listing);
    const preview = buildCianSaleListingPreview(source);
    assert.equal(preview.ready, true);
    assert.equal(preview.payload?.category, "flatSale");
    assert.equal(preview.payload?.externalId, listing.id);
    assert.equal(preview.payload?.price, 12_500_000);
    assert.equal(preview.payload?.currency, "rur");
    assert.equal(preview.payload?.flatRoomsCount, 2);
    assert.equal(preview.payload?.totalArea, 54);
    assert.equal(preview.payload?.floorNumber, 3);
    assert.equal(preview.payload?.buildingFloorsCount, 9);
    assert.ok(preview.payload?.address.includes("Тестовый"));
    assert.equal(preview.payload?.phones[0]?.countryCode, "7");
    assert.equal(preview.payload?.phones[0]?.number, "9001234567");
  });

  it("studio mapping uses Property.rooms without inventing FlatRoomsCount=9", async () => {
    const { listing } = await createReadySaleListing({ type: "STUDIO" });
    const payload = mapToCianSalePayload(
      buildCianSaleListingPreview(toSalePublicationListingSource(listing)).normalized,
    );
    assert.equal(payload.category, "flatSale");
    assert.equal(payload.flatRoomsCount, 0);
  });

  it("unsupported property type rejected", async () => {
    const { listing } = await createReadySaleListing({ type: "HOUSE" });
    await prisma.property.update({
      where: { id: listing.propertyId },
      data: { floor: 1 },
    });
    const refreshed = await prisma.saleListing.findUniqueOrThrow({
      where: { id: listing.id },
      include: {
        property: true,
        photos: { include: { propertyPhoto: true }, orderBy: { order: "asc" } },
      },
    });
    const validation = validateCianSalePublication(
      buildCianSaleListingPreview(toSalePublicationListingSource(refreshed)).normalized,
    );
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((item) => item.code === "CIAN_UNSUPPORTED_PROPERTY_TYPE"));
  });

  it("photo order preserved; first is default; XML escaping deterministic", async () => {
    const { listing, second, first } = await createReadySaleListing();
    await updateSaleListing(listing.id, {
      description: 'Описание с <тегами> & "кавычками" \'апостроф\'',
    });
    const refreshed = await prisma.saleListing.findUniqueOrThrow({
      where: { id: listing.id },
      include: {
        property: true,
        photos: { include: { propertyPhoto: true }, orderBy: { order: "asc" } },
      },
    });
    const preview = buildCianSaleListingPreview(toSalePublicationListingSource(refreshed));
    assert.equal(preview.ready, true);
    assert.equal(preview.payload!.photos[0].fullUrl, second.url);
    assert.equal(preview.payload!.photos[0].isDefault, true);
    assert.equal(preview.payload!.photos[1].fullUrl, first.url);
    assert.equal(preview.payload!.photos[1].isDefault, false);

    const xml = preview.xml!;
    assert.ok(xml.includes("&lt;тегами&gt;"));
    assert.ok(xml.includes("&amp;"));
    assert.ok(xml.includes("&quot;"));
    assert.equal(xml, serializeCianSaleFeed([preview.payload!]));
    assert.equal(hashCianSalePayload(preview.payload!), preview.cianPayloadHash);
  });

  it("invalid object isolated from batch", async () => {
    const ready = await createReadySaleListing();
    const badSource = toSalePublicationListingSource(ready.listing);
    const goodNorm = buildCianSaleListingPreview(badSource).normalized;
    const badNorm = { ...goodNorm, listingId: "bad", propertyType: "HOUSE" as const, floor: 1 };
    const prepared = prepareCianSaleFeedItems([goodNorm, badNorm]);
    assert.equal(prepared.validItems.length, 1);
    assert.equal(prepared.invalidItems.length, 1);
    assert.equal(prepared.invalidItems[0].listingId, "bad");
  });

  it("preview does not mutate publication; prepare → PUBLISHING never PUBLISHED", async () => {
    const { listing, cian } = await createReadySaleListing();
    const created = await createSalePublication({
      saleListingId: listing.id,
      salesChannelId: cian.id,
    });
    const before = created.publication.status;
    buildCianSaleListingPreview(toSalePublicationListingSource(listing));
    const afterPreview = await prisma.salePublication.findUniqueOrThrow({
      where: { id: created.publication.id },
    });
    assert.equal(afterPreview.status, before);

    const prepared = await prepareCianSalePublication(listing.id);
    assert.equal(prepared.published, false);
    assert.equal(prepared.publication.status, "PUBLISHING");
    assert.notEqual(prepared.publication.status, "PUBLISHED");
  });

  it("feed eligibility and exclusions", async () => {
    const { listing, cian } = await createReadySaleListing();
    const created = await createSalePublication({
      saleListingId: listing.id,
      salesChannelId: cian.id,
    });
    assert.equal(isIncludedInCianSaleFeed("NOT_PUBLISHED"), false);

    let feed = await buildPublicCianSaleFeed();
    assert.equal(feed.validItems.length, 0);

    await prepareCianSalePublication(listing.id);
    feed = await buildPublicCianSaleFeed();
    assert.equal(feed.validItems.length, 1);
    assert.equal(feed.validItems[0].externalId, listing.id);
    assert.ok(!feed.xml.includes("buyer"));
    assert.ok(!feed.xml.includes("Buyer"));

    await prisma.salePublication.update({
      where: { id: created.publication.id },
      data: { status: "UPDATE_PENDING" },
    });
    feed = await buildPublicCianSaleFeed();
    assert.equal(feed.validItems.length, 1);

    await prisma.salePublication.update({
      where: { id: created.publication.id },
      data: { status: "PUBLISHED", lastSuccessAt: new Date() },
    });
    feed = await buildPublicCianSaleFeed();
    assert.equal(feed.validItems.length, 1);

    await prisma.saleListing.update({
      where: { id: listing.id },
      data: { status: "SOLD" },
    });
    feed = await buildPublicCianSaleFeed();
    assert.equal(feed.validItems.length, 0);
  });

  it("invalid readiness excluded; buyer/viewing/deposit absent from XML; hash changes on price", async () => {
    const { listing } = await createReadySaleListing();
    const preview1 = buildCianSaleListingPreview(toSalePublicationListingSource(listing));
    assert.equal(preview1.ready, true);
    const hash1 = preview1.cianPayloadHash!;

    await prisma.saleListing.update({
      where: { id: listing.id },
      data: { price: 0 },
    });
    const broken = await prisma.saleListing.findUniqueOrThrow({
      where: { id: listing.id },
      include: {
        property: true,
        photos: { include: { propertyPhoto: true }, orderBy: { order: "asc" } },
      },
    });
    const previewBroken = buildCianSaleListingPreview(toSalePublicationListingSource(broken));
    assert.equal(previewBroken.ready, false);

    await updateSaleListing(listing.id, { price: 13_000_000 });
    const updated = await prisma.saleListing.findUniqueOrThrow({
      where: { id: listing.id },
      include: {
        property: true,
        photos: { include: { propertyPhoto: true }, orderBy: { order: "asc" } },
      },
    });
    const preview2 = buildCianSaleListingPreview(toSalePublicationListingSource(updated));
    assert.notEqual(preview2.cianPayloadHash, hash1);

    const buyer = await createBuyer({ name: "Secret Buyer" });
    const interest = await createBuyerInterest({
      buyerId: buyer.id,
      saleListingId: listing.id,
    });
    await scheduleViewing(interest.interest.id, {
      scheduledAt: "2026-12-10T10:00:00.000Z",
    });
    await createDeposit(interest.interest.id, { amount: 100000 });
    const afterCrm = await prisma.saleListing.findUniqueOrThrow({
      where: { id: listing.id },
      include: {
        property: true,
        photos: { include: { propertyPhoto: true }, orderBy: { order: "asc" } },
      },
    });
    const preview3 = buildCianSaleListingPreview(toSalePublicationListingSource(afterCrm));
    assert.equal(preview3.cianPayloadHash, preview2.cianPayloadHash);
    assert.ok(preview3.xml);
    assert.ok(!preview3.xml!.includes("Secret Buyer"));
    assert.ok(!preview3.xml!.includes("100000"));
  });
});
