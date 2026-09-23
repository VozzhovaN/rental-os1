import "./helpers-preload";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { GET as getPublicCianFeed } from "@/app/api/feeds/cian/long-term.xml/route";
import { POST as postCianPrepare } from "@/app/api/long-term-listings/[id]/publications/cian/prepare/route";
import { redactSecrets } from "@/lib/integrations/crypto";
import {
  createLongTermListing,
  replaceLongTermPhotos,
  updateLongTermListing,
} from "@/lib/long-term-listings";
import { prisma } from "@/lib/prisma";
import {
  applyPublicationEvent,
  createPublication,
  serializePublication,
} from "@/lib/publications";
import {
  CIAN_STATUS_SYNC,
  CIAN_UNPUBLISH,
  buildPublicCianLongTermFeed,
  detectCianPayloadUpdate,
  getCianEnvConfig,
  isCianStatusSyncAvailable,
  isCianUnpublishAvailable,
  prepareCianPublication,
} from "@/lib/publications/providers/cian";
import { createPropertyPhoto } from "@/lib/property-photos";
import { canTransitionPublication, nextPublicationStatus } from "@/lib/publications/state-machine";
import { authedRequest, createTestSessionCookie } from "../helpers/auth";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";

describe("cian real integration (stage 8.3)", () => {
  let authCookie: string;

  before(async () => {
    await prepareTestDatabase();
    const session = await createTestSessionCookie();
    authCookie = session.cookie;
  });

  async function createCianChannel() {
    return prisma.salesChannel.create({
      data: { code: "CIAN", name: "ЦИАН", isActive: true },
    });
  }

  async function createValidListing(propertyId: string) {
    await prisma.property.update({
      where: { id: propertyId },
      data: { floor: 4, totalFloors: 9 },
    });
    const created = await createLongTermListing({ propertyId });
    const listing = await updateLongTermListing(created.listing.id, {
      status: "ACTIVE",
      monthlyPrice: 70000,
      deposit: 70000,
      commission: 0,
      minimumRentalPeriod: 6,
      marketingTitle: "Светлая квартира",
      description: "Светлая квартира у парка. Отдельная кухня, мебель, техника.",
      rentalTerms: "От 6 месяцев",
      publicationContactName: "Анна",
      publicationPhoneCountryCode: "7",
      publicationPhoneNumber: "9001234567",
    });
    const photo = await createPropertyPhoto(propertyId, {
      url: "https://cdn.example.com/a.jpg",
    });
    return (await replaceLongTermPhotos(listing.id, {
      items: [{ photoId: photo.id, sortOrder: 0, included: true }],
    }))!;
  }

  it("public feed returns valid XML with Content-Type", async () => {
    const { property } = await resetFixtures();
    await createCianChannel();
    const listing = await createValidListing(property.id);
    await prepareCianPublication(listing.id);

    const response = await getPublicCianFeed();
    const xml = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("Content-Type") ?? "", /application\/xml/);
    assert.ok(xml.includes('<?xml version="1.0" encoding="UTF-8"?>'));
    assert.ok(xml.includes("<Feed>"));
    assert.ok(xml.includes(`<ExternalId>${listing.id}</ExternalId>`));
    assert.ok(!xml.toLowerCase().includes("cian_access_key"));
    assert.ok(!xml.includes("access_token"));
    assert.ok(!xml.includes("Guest"));
    assert.ok(!/ownerPhone|buyerPhone/i.test(xml));
  });

  it("valid listing included; invalid listing isolated", async () => {
    const { property } = await resetFixtures();
    await createCianChannel();
    const valid = await createValidListing(property.id);
    await prepareCianPublication(valid.id);

    const property2 = await prisma.property.create({
      data: {
        name: "Broken",
        slug: `broken-${Date.now()}`,
        type: "APARTMENT",
        status: "ACTIVE",
        address: "ул. Тестовая, 99",
        city: "Тестовый город",
        district: "Район Т",
        area: 40,
        rooms: 1,
        bedrooms: 1,
        bathrooms: 1,
        floor: 2,
        totalFloors: 5,
        guests: 2,
        description: "x",
        shortDescription: "x",
        ownerName: "Owner",
        ownerPhone: "+7 000 000-00-99",
        managementType: "OWN",
      },
    });
    const invalidCreated = await createLongTermListing({ propertyId: property2.id });
    const invalid = await updateLongTermListing(invalidCreated.listing.id, {
      status: "ACTIVE",
      monthlyPrice: 50000,
      deposit: 50000,
      commission: 0,
      minimumRentalPeriod: 6,
      description: "коротко",
      publicationContactName: "Боб",
      publicationPhoneCountryCode: "7",
      publicationPhoneNumber: "9009999999",
    });
    const channel = await prisma.salesChannel.findUniqueOrThrow({ where: { code: "CIAN" } });
    await createPublication({
      longTermListingId: invalid.id,
      salesChannelId: channel.id,
    });
    await applyPublicationEvent(
      (await prisma.publication.findFirstOrThrow({ where: { longTermListingId: invalid.id } })).id,
      "START_PUBLISH",
      {},
    );

    const feed = await buildPublicCianLongTermFeed();
    assert.ok(feed.xml.includes(`<ExternalId>${valid.id}</ExternalId>`));
    assert.ok(!feed.xml.includes(`<ExternalId>${invalid.id}</ExternalId>`));
    assert.equal(feed.invalidItems.length >= 1, true);
    assert.ok(feed.invalidItems.some((item) => item.listingId === invalid.id));
  });

  it("deterministic public feed", async () => {
    const { property } = await resetFixtures();
    await createCianChannel();
    const listing = await createValidListing(property.id);
    await prepareCianPublication(listing.id);

    const a = await buildPublicCianLongTermFeed();
    const b = await buildPublicCianLongTermFeed();
    assert.equal(a.xml, b.xml);
  });

  it("prepare does not mark PUBLISHED from generation alone", async () => {
    const { property } = await resetFixtures();
    await createCianChannel();
    const listing = await createValidListing(property.id);

    const result = await prepareCianPublication(listing.id);
    assert.equal(result.publication.status, "PUBLISHING");
    assert.ok(result.publication.lastSerializedHash);
    assert.equal(result.blockers.statusSync, CIAN_STATUS_SYNC);
    assert.equal(result.blockers.unpublish, CIAN_UNPUBLISH);

    const response = await postCianPrepare(authedRequest("http://localhost", authCookie), {
      params: Promise.resolve({ id: listing.id }),
    });
    const body = (await response.json()) as { publication: { status: string } };
    assert.equal(body.publication.status, "PUBLISHING");
    assert.notEqual(body.publication.status, "PUBLISHED");
  });

  it("payload change detection: PUBLISHED + hash change → UPDATE_PENDING", async () => {
    const { property } = await resetFixtures();
    const channel = await createCianChannel();
    const listing = await createValidListing(property.id);
    const prepared = await prepareCianPublication(listing.id);

    await prisma.publication.update({
      where: { id: prepared.publication.id },
      data: {
        status: "PUBLISHED",
        externalId: "cian-ext-1",
        lastSuccessAt: new Date(),
      },
    });

    await updateLongTermListing(listing.id, {
      description: "Светлая квартира у парка. Обновлённое описание для смены hash payload.",
    });

    const detected = await detectCianPayloadUpdate(listing.id);
    assert.equal(detected.payloadChanged, true);
    assert.equal(detected.transitioned, true);
    assert.equal(detected.publication?.status, "UPDATE_PENDING");

    const again = await detectCianPayloadUpdate(listing.id);
    assert.equal(again.transitioned, false);
    assert.equal(again.publication?.status, "UPDATE_PENDING");

    void channel;
  });

  it("NOT_PUBLISHED listing not in public feed", async () => {
    const { property } = await resetFixtures();
    await createCianChannel();
    const listing = await createValidListing(property.id);
    const channel = await prisma.salesChannel.findUniqueOrThrow({ where: { code: "CIAN" } });
    await createPublication({
      longTermListingId: listing.id,
      salesChannelId: channel.id,
    });

    const feed = await buildPublicCianLongTermFeed();
    assert.ok(!feed.xml.includes(`<ExternalId>${listing.id}</ExternalId>`));
  });

  it("secrets redacted; status/unpublish blocked without inventing clients", () => {
    const config = getCianEnvConfig();
    assert.equal(config.accessKey, null);
    assert.equal(isCianStatusSyncAvailable(), false);
    assert.equal(isCianUnpublishAvailable(), false);

    const redacted = redactSecrets('CIAN_ACCESS_KEY=super-secret-key-value access_key":"abc123"');
    assert.ok(!redacted.includes("super-secret-key-value"));
    assert.ok(!redacted.includes("abc123"));
  });

  it("Publication FSM regression: START_PUBLISH / CONFIRM only via events", () => {
    assert.equal(nextPublicationStatus("NOT_PUBLISHED", "START_PUBLISH"), "PUBLISHING");
    assert.equal(nextPublicationStatus("PUBLISHING", "CONFIRM_PUBLISHED"), "PUBLISHED");
    assert.equal(canTransitionPublication("PUBLISHING", "START_UPDATE"), false);
    assert.equal(nextPublicationStatus("PUBLISHED", "START_UPDATE"), "UPDATE_PENDING");
  });

  it("serializePublication exposes lastSerializedHash", async () => {
    const { property } = await resetFixtures();
    await createCianChannel();
    const listing = await createValidListing(property.id);
    const prepared = await prepareCianPublication(listing.id);
    const dto = serializePublication(
      await prisma.publication.findUniqueOrThrow({
        where: { id: prepared.publication.id },
        include: { salesChannel: true },
      }),
    );
    assert.equal(dto.status, "PUBLISHING");
    assert.ok(dto.lastSerializedHash);
  });
});
