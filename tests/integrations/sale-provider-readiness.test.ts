import "./helpers-preload";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createBuyer } from "@/lib/buyers";
import { createBuyerInterest } from "@/lib/buyer-interests";
import { prisma } from "@/lib/prisma";
import {
  AVITO_SALE_CAPABILITIES,
  buildAvitoSaleDiagnostics,
} from "@/lib/publications/providers/avito/sale";
import {
  DOMCLICK_SALE_CAPABILITIES,
  buildDomclickSaleDiagnostics,
} from "@/lib/publications/providers/domclick/sale";
import { CIAN_SALE_CAPABILITIES } from "@/lib/publications/providers/cian/sale";
import { isSaleProviderFeedReady } from "@/lib/publications/providers/sale-capabilities";
import {
  applySalePublicationEvent,
  createSalePublication,
  prepareSalePublication,
  SalePublicationError,
  toSalePublicationListingSource,
} from "@/lib/sale-publications";
import { createSaleListing, updateSaleListing } from "@/lib/sale-listings";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";

async function setupSaleWithChannels() {
  const { property } = await resetFixtures();
  await prisma.property.update({
    where: { id: property.id },
    data: { floor: 2, type: "APARTMENT" },
  });
  const avito = await prisma.salesChannel.findFirstOrThrow({ where: { code: "AVITO" } });
  const cian = await prisma.salesChannel.create({
    data: { code: "CIAN", name: "ЦИАН", isActive: true },
  });
  const domclick = await prisma.salesChannel.create({
    data: { code: "DOMCLICK", name: "Домклик", isActive: true },
  });
  const created = await createSaleListing({ propertyId: property.id });
  const listing = await updateSaleListing(created.listing.id, {
    status: "ACTIVE",
    price: 8_000_000,
    description: "Описание продажи для diagnostics readiness и provider boundary.",
    publicationContactName: "Иван",
    publicationPhoneCountryCode: "7",
    publicationPhoneNumber: "9001112233",
  });
  return { listing, avito, cian, domclick };
}

describe("sale provider readiness avito/domclick", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  it("AVITO sale never uses short-term ChannelListing; DOMCLICK never uses LongTerm Publication", async () => {
    const { listing } = await setupSaleWithChannels();
    const source = toSalePublicationListingSource(listing);
    const avito = buildAvitoSaleDiagnostics(source);
    const domclick = buildDomclickSaleDiagnostics(source);
    assert.equal(avito.usesChannelListing, false);
    assert.equal(avito.usesLongTermPublication, false);
    assert.equal(domclick.usesChannelListing, false);
    assert.equal(domclick.usesLongTermPublication, false);
    assert.equal(avito.serializerImplemented, false);
    assert.equal(domclick.serializerImplemented, false);
  });

  it("provider validation consumes NormalizedSalePublicationData path via diagnostics", async () => {
    const { listing } = await setupSaleWithChannels();
    const source = toSalePublicationListingSource(listing);
    const avito = buildAvitoSaleDiagnostics(source);
    assert.equal(typeof avito.baseline.ready, "boolean");
    assert.ok(Array.isArray(avito.baseline.errors));
    assert.ok(avito.messages.some((item) => item.includes("Autoload") || item.includes("serializer")));
  });

  it("blocked provider capability does not fake serializer or feed", async () => {
    assert.equal(isSaleProviderFeedReady(AVITO_SALE_CAPABILITIES), false);
    assert.equal(isSaleProviderFeedReady(DOMCLICK_SALE_CAPABILITIES), false);
    assert.equal(isSaleProviderFeedReady(CIAN_SALE_CAPABILITIES), true);
    assert.equal(AVITO_SALE_CAPABILITIES.preview, "BLOCKED_BY_PROVIDER_CONFIRMATION");
    assert.equal(DOMCLICK_SALE_CAPABILITIES.feed, "BLOCKED_BY_PROVIDER_ACCESS");
  });

  it("blocked provider cannot prepare or become PUBLISHED", async () => {
    const { listing, avito, domclick } = await setupSaleWithChannels();
    const createdAvito = await createSalePublication({
      saleListingId: listing.id,
      salesChannelId: avito.id,
    });
    await assert.rejects(
      () => prepareSalePublication(createdAvito.publication.id),
      (error: unknown) => error instanceof SalePublicationError && error.code === "VALIDATION",
    );
    await assert.rejects(
      () => applySalePublicationEvent(createdAvito.publication.id, "CONFIRM_PUBLISHED"),
      (error: unknown) => error instanceof SalePublicationError && error.code === "VALIDATION",
    );

    const createdDom = await createSalePublication({
      saleListingId: listing.id,
      salesChannelId: domclick.id,
    });
    await assert.rejects(
      () => prepareSalePublication(createdDom.publication.id),
      (error: unknown) => error instanceof SalePublicationError && error.code === "VALIDATION",
    );
    await assert.rejects(
      () => applySalePublicationEvent(createdDom.publication.id, "CONFIRM_PUBLISHED"),
      (error: unknown) => error instanceof SalePublicationError && error.code === "VALIDATION",
    );

    const refreshed = await prisma.salePublication.findUniqueOrThrow({
      where: { id: createdAvito.publication.id },
    });
    assert.notEqual(refreshed.status, "PUBLISHED");
  });

  it("SOLD excluded messaging; Buyer data absent from diagnostics messages content", async () => {
    const { listing } = await setupSaleWithChannels();
    const buyer = await createBuyer({ name: "Hidden Buyer X" });
    await createBuyerInterest({ buyerId: buyer.id, saleListingId: listing.id });
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
    const avito = buildAvitoSaleDiagnostics(toSalePublicationListingSource(sold));
    assert.equal(avito.soldBlocked, true);
    assert.ok(avito.messages.some((item) => item.includes("продан")));
    assert.ok(!avito.messages.some((item) => item.includes("Hidden Buyer")));
  });

  it("secrets / credentials not embedded in capability constants", () => {
    const blob = JSON.stringify({
      avito: AVITO_SALE_CAPABILITIES,
      domclick: DOMCLICK_SALE_CAPABILITIES,
      cian: CIAN_SALE_CAPABILITIES,
    });
    assert.ok(!blob.toLowerCase().includes("secret"));
    assert.ok(!blob.toLowerCase().includes("token"));
    assert.ok(!blob.includes("Bearer"));
  });
});
