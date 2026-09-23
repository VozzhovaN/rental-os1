import "./helpers-preload";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createBuyer } from "@/lib/buyers";
import { createBuyerInterest } from "@/lib/buyer-interests";
import { createDeposit } from "@/lib/deposits";
import { prisma } from "@/lib/prisma";
import { createPropertyPhoto } from "@/lib/property-photos";
import {
  buildNormalizedSalePublicationData,
  hashNormalizedSalePublicationData,
} from "@/lib/publications/normalized-sale";
import { validateSalePublicationReadiness } from "@/lib/publications/sale-readiness";
import {
  applySalePublicationEvent,
  createSalePublication,
  prepareSalePublication,
  SalePublicationError,
  toSalePublicationListingSource,
} from "@/lib/sale-publications";
import {
  createSaleListing,
  replaceSaleListingPhotos,
  updateSaleListing,
} from "@/lib/sale-listings";
import { parseCreateSalePublication } from "@/lib/validations/sale-publication";
import { parseUpdateSaleListing } from "@/lib/validations/sale-listing";
import { scheduleViewing } from "@/lib/viewings";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";

async function createSaleChannel(code: "CIAN" | "DOMCLICK" | "SUTOCHNO", name: string) {
  return prisma.salesChannel.create({
    data: { code, name, isActive: true },
  });
}

async function createReadySaleListing() {
  const { channel, property } = await resetFixtures();
  await prisma.property.update({
    where: { id: property.id },
    data: { floor: 5 },
  });
  const created = await createSaleListing({ propertyId: property.id });
  const listing = await updateSaleListing(created.listing.id, {
    status: "ACTIVE",
    price: 9_500_000,
    marketingTitle: "Продажа — тест",
    description: "Описание продажи для публикации",
    publicationContactName: "Мария",
    publicationPhoneCountryCode: "7",
    publicationPhoneNumber: "9001112233",
  });
  const first = await createPropertyPhoto(property.id, {
    url: "https://cdn.example.com/sale-a.jpg",
  });
  const second = await createPropertyPhoto(property.id, {
    url: "https://cdn.example.com/sale-b.jpg",
  });
  const withPhotos = await replaceSaleListingPhotos(listing.id, {
    items: [
      { photoId: second.id, order: 0 },
      { photoId: first.id, order: 1 },
    ],
  });
  return { channel, property, listing: withPhotos!, first, second };
}

describe("sale publication core", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  it("одна публикация на SaleListing/channel; повтор идемпотентен", async () => {
    const { channel, listing } = await createReadySaleListing();
    const first = await createSalePublication({
      saleListingId: listing.id,
      salesChannelId: channel.id,
    });
    const second = await createSalePublication({
      saleListingId: listing.id,
      salesChannelId: channel.id,
    });
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(first.publication.id, second.publication.id);
    assert.equal(await prisma.salePublication.count({ where: { saleListingId: listing.id } }), 1);
  });

  it("только AVITO/CIAN/DOMCLICK; short-term канал отклонён", async () => {
    const { listing } = await createReadySaleListing();
    const sutochono = await createSaleChannel("SUTOCHNO", "Суточно");
    await assert.rejects(
      () =>
        createSalePublication({
          saleListingId: listing.id,
          salesChannelId: sutochono.id,
        }),
      (error: unknown) => error instanceof SalePublicationError && error.code === "VALIDATION",
    );
  });

  it("SOLD и ARCHIVED нельзя стартовать новой публикацией", async () => {
    const { channel, listing } = await createReadySaleListing();
    await prisma.saleListing.update({
      where: { id: listing.id },
      data: { status: "SOLD" },
    });
    await assert.rejects(
      () =>
        createSalePublication({
          saleListingId: listing.id,
          salesChannelId: channel.id,
        }),
      (error: unknown) => error instanceof SalePublicationError && error.code === "VALIDATION",
    );

    await prisma.saleListing.update({
      where: { id: listing.id },
      data: { status: "ARCHIVED" },
    });
    await assert.rejects(
      () =>
        createSalePublication({
          saleListingId: listing.id,
          salesChannelId: channel.id,
        }),
      (error: unknown) => error instanceof SalePublicationError && error.code === "VALIDATION",
    );
  });

  it("валидная ACTIVE карточка prepare → PUBLISHING, не PUBLISHED", async () => {
    const { listing } = await createReadySaleListing();
    const cian = await createSaleChannel("CIAN", "ЦИАН");
    const created = await createSalePublication({
      saleListingId: listing.id,
      salesChannelId: cian.id,
    });
    const result = await prepareSalePublication(created.publication.id);
    assert.equal(result.prepared, true);
    assert.equal(result.published, false);
    assert.equal(result.publication.status, "PUBLISHING");
    assert.notEqual(result.publication.status, "PUBLISHED");
    assert.ok(result.payloadHash);
    assert.equal(result.publication.lastSerializedHash, result.payloadHash);
  });

  it("AVITO prepare blocked without confirmed Autoload sale serializer", async () => {
    const { channel, listing } = await createReadySaleListing();
    const created = await createSalePublication({
      saleListingId: listing.id,
      salesChannelId: channel.id,
    });
    await assert.rejects(
      () => prepareSalePublication(created.publication.id),
      (error: unknown) => error instanceof SalePublicationError && error.code === "VALIDATION",
    );
  });

  it("invalid price / missing description / missing contact / invalid phone block readiness", async () => {
    const { listing } = await createReadySaleListing();
    const source = toSalePublicationListingSource(listing!);

    const noPrice = validateSalePublicationReadiness({ ...source, price: 0 });
    assert.equal(noPrice.ready, false);
    assert.ok(noPrice.errors.some((item) => item.code === "INVALID_PRICE"));

    const noDescription = validateSalePublicationReadiness({ ...source, description: null });
    assert.equal(noDescription.ready, false);
    assert.ok(noDescription.errors.some((item) => item.code === "MISSING_DESCRIPTION"));

    const noContact = validateSalePublicationReadiness({
      ...source,
      publicationContactName: null,
    });
    assert.equal(noContact.ready, false);
    assert.ok(noContact.errors.some((item) => item.code === "MISSING_PUBLICATION_CONTACT"));

    const badPhone = validateSalePublicationReadiness({
      ...source,
      publicationPhoneNumber: "abc",
    });
    assert.equal(badPhone.ready, false);
    assert.ok(badPhone.errors.some((item) => item.code === "INVALID_PUBLICATION_PHONE"));
  });

  it("non-public photo URL detected; photo order preserved", async () => {
    const { listing, property, second, first } = await createReadySaleListing();
    const localPhoto = await createPropertyPhoto(property.id, {
      url: "http://localhost:3000/local.jpg",
    });
    const withLocal = await replaceSaleListingPhotos(listing.id, {
      items: [
        { photoId: second.id, order: 0 },
        { photoId: first.id, order: 1 },
        { photoId: localPhoto.id, order: 2 },
      ],
    });
    const source = toSalePublicationListingSource(withLocal!);
    const normalized = buildNormalizedSalePublicationData(source);
    assert.equal(normalized.photos[0].id, second.id);
    assert.equal(normalized.photos[0].isPrimary, true);
    assert.equal(normalized.photos[1].id, first.id);

    const readiness = validateSalePublicationReadiness(source, normalized);
    assert.equal(readiness.ready, false);
    assert.ok(readiness.errors.some((item) => item.code === "PHOTO_URL_NOT_PUBLIC"));
  });

  it("normalized hash deterministic; relevant change updates; buyer data ignored", async () => {
    const { listing } = await createReadySaleListing();
    const source = toSalePublicationListingSource(listing!);
    const a = hashNormalizedSalePublicationData(buildNormalizedSalePublicationData(source));
    const b = hashNormalizedSalePublicationData(buildNormalizedSalePublicationData(source));
    assert.equal(a, b);

    const changed = await updateSaleListing(listing!.id, { price: 9_600_000 });
    const changedHash = hashNormalizedSalePublicationData(
      buildNormalizedSalePublicationData(toSalePublicationListingSource(changed)),
    );
    assert.notEqual(a, changedHash);

    const buyer = await createBuyer({ name: "Hash Buyer" });
    await createBuyerInterest({ buyerId: buyer.id, saleListingId: listing!.id });
    await scheduleViewing(
      (
        await prisma.buyerInterest.findFirstOrThrow({
          where: { buyerId: buyer.id, saleListingId: listing!.id },
        })
      ).id,
      { scheduledAt: "2026-12-01T10:00:00.000Z" },
    );
    await createDeposit(
      (
        await prisma.buyerInterest.findFirstOrThrow({
          where: { buyerId: buyer.id, saleListingId: listing!.id },
        })
      ).id,
      { amount: 100_000 },
    );

    const afterCrm = await prisma.saleListing.findUniqueOrThrow({
      where: { id: listing!.id },
      include: {
        property: true,
        photos: { include: { propertyPhoto: true }, orderBy: { order: "asc" } },
      },
    });
    const afterHash = hashNormalizedSalePublicationData(
      buildNormalizedSalePublicationData(toSalePublicationListingSource(afterCrm)),
    );
    assert.equal(changedHash, afterHash);
  });

  it("immutable relation IDs; arbitrary status mutation blocked via schema", async () => {
    assert.equal(
      parseCreateSalePublication({
        salesChannelId: "x",
        saleListingId: "y",
        status: "PUBLISHED",
        externalId: "1",
      }).success,
      false,
    );
    assert.equal(
      parseUpdateSaleListing({
        propertyId: "x",
        publications: [],
      }).success,
      false,
    );

    const { channel, listing } = await createReadySaleListing();
    const created = await createSalePublication({
      saleListingId: listing.id,
      salesChannelId: channel.id,
    });
    await assert.rejects(
      () => applySalePublicationEvent(created.publication.id, "CONFIRM_PUBLISHED"),
      (error: unknown) => error instanceof SalePublicationError && error.code === "VALIDATION",
    );
  });

  it("SOLD readiness marks LISTING_SOLD; existing publication preserved", async () => {
    const { channel, listing } = await createReadySaleListing();
    const created = await createSalePublication({
      saleListingId: listing.id,
      salesChannelId: channel.id,
    });
    await prisma.saleListing.update({
      where: { id: listing.id },
      data: { status: "SOLD" },
    });
    const sold = await prisma.saleListing.findUniqueOrThrow({
      where: { id: listing.id },
      include: {
        property: true,
        photos: { include: { propertyPhoto: true }, orderBy: { order: "asc" } },
      },
    });
    const readiness = validateSalePublicationReadiness(toSalePublicationListingSource(sold));
    assert.equal(readiness.ready, false);
    assert.ok(readiness.errors.some((item) => item.code === "LISTING_SOLD"));
    assert.equal(
      await prisma.salePublication.count({ where: { id: created.publication.id } }),
      1,
    );
  });
});
