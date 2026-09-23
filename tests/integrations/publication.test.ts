import "./helpers-preload";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
  GET as getPublication,
} from "@/app/api/long-term-listings/[id]/publications/[publicationId]/route";
import {
  GET as getPublications,
  POST as postPublication,
} from "@/app/api/long-term-listings/[id]/publications/route";
import { archiveLongTermListing, createLongTermListing } from "@/lib/long-term-listings";
import { prisma } from "@/lib/prisma";
import {
  applyPublicationEvent,
  createPublication,
  PublicationError,
  serializePublication,
} from "@/lib/publications";
import {
  canTransitionPublication,
  nextPublicationStatus,
} from "@/lib/publications/state-machine";
import { authedRequest, createTestSessionCookie } from "../helpers/auth";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";

describe("publications", () => {
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

  it("создаёт Publication в NOT_PUBLISHED без externalId", async () => {
    const { channel, property } = await resetFixtures();
    const listing = await createLongTermListing({ propertyId: property.id });
    const result = await createPublication({
      longTermListingId: listing.listing.id,
      salesChannelId: channel.id,
    });
    assert.equal(result.created, true);
    assert.equal(result.publication.status, "NOT_PUBLISHED");
    assert.equal(result.publication.externalId, null);
    assert.equal(result.publication.externalStatus, null);
    assert.equal(await prisma.channelListing.count(), 0);
  });

  it("не создаёт дубликат LongTermListing + SalesChannel", async () => {
    const { channel, property } = await resetFixtures();
    const listing = await createLongTermListing({ propertyId: property.id });
    const first = await createPublication({
      longTermListingId: listing.listing.id,
      salesChannelId: channel.id,
    });
    const second = await createPublication({
      longTermListingId: listing.listing.id,
      salesChannelId: channel.id,
    });
    assert.equal(second.created, false);
    assert.equal(second.publication.id, first.publication.id);
    assert.equal(await prisma.publication.count(), 1);
  });

  it("позволяет по одной Publication на разные каналы", async () => {
    const { channel, property } = await resetFixtures();
    const cian = await createCianChannel();
    const listing = await createLongTermListing({ propertyId: property.id });
    await createPublication({
      longTermListingId: listing.listing.id,
      salesChannelId: channel.id,
    });
    const second = await createPublication({
      longTermListingId: listing.listing.id,
      salesChannelId: cian.id,
    });
    assert.equal(second.created, true);
    assert.equal(await prisma.publication.count(), 2);
  });

  it("отклоняет ARCHIVED LongTermListing", async () => {
    const { channel, property } = await resetFixtures();
    const listing = await createLongTermListing({ propertyId: property.id });
    await archiveLongTermListing(listing.listing.id);
    await assert.rejects(
      () =>
        createPublication({
          longTermListingId: listing.listing.id,
          salesChannelId: channel.id,
        }),
      (error: unknown) => error instanceof PublicationError && error.code === "VALIDATION",
    );
  });

  it("отклоняет неизвестный и нецелевой SalesChannel", async () => {
    const { property } = await resetFixtures();
    const listing = await createLongTermListing({ propertyId: property.id });
    await assert.rejects(
      () =>
        createPublication({
          longTermListingId: listing.listing.id,
          salesChannelId: "missing-channel",
        }),
      (error: unknown) => error instanceof PublicationError && error.code === "NOT_FOUND",
    );

    const korzina = await prisma.salesChannel.create({
      data: { code: "KORZINA", name: "Корзина", isActive: true },
    });
    await assert.rejects(
      () =>
        createPublication({
          longTermListingId: listing.listing.id,
          salesChannelId: korzina.id,
        }),
      (error: unknown) =>
        error instanceof PublicationError && error.message.includes("не поддерживает"),
    );
  });

  it("отклоняет неактивный канал публикации", async () => {
    const { property } = await resetFixtures();
    const listing = await createLongTermListing({ propertyId: property.id });
    const inactive = await prisma.salesChannel.create({
      data: { code: "DOMCLICK", name: "Домклик", isActive: false },
    });
    await assert.rejects(
      () =>
        createPublication({
          longTermListingId: listing.listing.id,
          salesChannelId: inactive.id,
        }),
      (error: unknown) => error instanceof PublicationError && error.code === "VALIDATION",
    );
  });

  it("фиксирует допустимые и запрещённые переходы, включая терминальные", () => {
    assert.equal(nextPublicationStatus("NOT_PUBLISHED", "START_PUBLISH"), "PUBLISHING");
    assert.equal(nextPublicationStatus("NOT_PUBLISHED", "CONFIRM_PUBLISHED"), null);
    assert.equal(nextPublicationStatus("PUBLISHING", "CONFIRM_PUBLISHED"), "PUBLISHED");
    assert.equal(nextPublicationStatus("PUBLISHING", "FAIL"), "ERROR");
    assert.equal(nextPublicationStatus("PUBLISHED", "START_UPDATE"), "UPDATE_PENDING");
    assert.equal(nextPublicationStatus("PUBLISHED", "START_UNPUBLISH"), "UNPUBLISHING");
    assert.equal(nextPublicationStatus("UPDATE_PENDING", "CONFIRM_PUBLISHED"), "PUBLISHED");
    assert.equal(nextPublicationStatus("UNPUBLISHING", "CONFIRM_UNPUBLISHED"), "UNPUBLISHED");
    assert.equal(nextPublicationStatus("UNPUBLISHED", "START_PUBLISH"), "PUBLISHING");
    assert.equal(nextPublicationStatus("UNPUBLISHED", "CONFIRM_PUBLISHED"), null);
    assert.equal(nextPublicationStatus("ERROR", "START_PUBLISH"), "PUBLISHING");
    assert.equal(nextPublicationStatus("PUBLISHED", "START_PUBLISH"), null);
    assert.equal(canTransitionPublication("ERROR", "START_UPDATE", { externalId: null }), false);
    assert.equal(canTransitionPublication("ERROR", "START_UPDATE", { externalId: "ext-1" }), true);
    assert.equal(canTransitionPublication("ERROR", "START_UNPUBLISH", { externalId: null }), false);
  });

  it("хранит ошибку без секретов и не меняет LongTermListing.status", async () => {
    const { channel, property } = await resetFixtures();
    const listing = await createLongTermListing({ propertyId: property.id });
    await prisma.longTermListing.update({
      where: { id: listing.listing.id },
      data: { status: "ACTIVE" },
    });
    const created = await createPublication({
      longTermListingId: listing.listing.id,
      salesChannelId: channel.id,
    });
    await applyPublicationEvent(created.publication.id, "START_PUBLISH");
    const failed = await applyPublicationEvent(created.publication.id, "FAIL", {
      error: 'Authorization: Bearer super-secret-token access_token=abc123',
    });
    assert.equal(failed.status, "ERROR");
    assert.equal(failed.lastError?.includes("super-secret-token"), false);
    assert.equal(failed.lastError?.includes("abc123"), false);
    assert.match(failed.lastError ?? "", /\[redacted\]/);
    const listingAfter = await prisma.longTermListing.findUnique({
      where: { id: listing.listing.id },
    });
    assert.equal(listingAfter?.status, "ACTIVE");
  });

  it("проходит внутренний цикл публикации без HTTP confirm", async () => {
    const { channel, property } = await resetFixtures();
    const listing = await createLongTermListing({ propertyId: property.id });
    const created = await createPublication({
      longTermListingId: listing.listing.id,
      salesChannelId: channel.id,
    });
    const publishing = await applyPublicationEvent(created.publication.id, "START_PUBLISH");
    assert.equal(publishing.status, "PUBLISHING");
    const published = await applyPublicationEvent(created.publication.id, "CONFIRM_PUBLISHED", {
      externalId: "avito-item-1",
      externalStatus: "active",
    });
    assert.equal(published.status, "PUBLISHED");
    assert.equal(published.externalId, "avito-item-1");
    assert.equal(published.externalStatus, "active");
    const pending = await applyPublicationEvent(created.publication.id, "START_UPDATE");
    assert.equal(pending.status, "UPDATE_PENDING");
    await applyPublicationEvent(created.publication.id, "CONFIRM_PUBLISHED");
    const unpublishing = await applyPublicationEvent(created.publication.id, "START_UNPUBLISH");
    assert.equal(unpublishing.status, "UNPUBLISHING");
    const unpublished = await applyPublicationEvent(created.publication.id, "CONFIRM_UNPUBLISHED");
    assert.equal(unpublished.status, "UNPUBLISHED");
  });

  it("отклоняет недопустимый переход", async () => {
    const { channel, property } = await resetFixtures();
    const listing = await createLongTermListing({ propertyId: property.id });
    const created = await createPublication({
      longTermListingId: listing.listing.id,
      salesChannelId: channel.id,
    });
    await assert.rejects(
      () => applyPublicationEvent(created.publication.id, "CONFIRM_PUBLISHED"),
      (error: unknown) => error instanceof PublicationError && error.code === "VALIDATION",
    );
  });

  it("API создаёт только NOT_PUBLISHED и отклоняет mass assignment", async () => {
    const { channel, property } = await resetFixtures();
    const listing = await createLongTermListing({ propertyId: property.id });
    const created = await postPublication(
      authedRequest("http://localhost/api", authCookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesChannelId: channel.id,
          status: "PUBLISHED",
          externalId: "hack",
          lastSuccessAt: new Date().toISOString(),
        }),
      }),
      { params: Promise.resolve({ id: listing.listing.id }) },
    );
    assert.equal(created.status, 400);

    const ok = await postPublication(
      authedRequest("http://localhost/api", authCookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salesChannelId: channel.id }),
      }),
      { params: Promise.resolve({ id: listing.listing.id }) },
    );
    assert.equal(ok.status, 201);
    const payload = (await ok.json()) as { publication: { status: string; externalId: string | null } };
    assert.equal(payload.publication.status, "NOT_PUBLISHED");
    assert.equal(payload.publication.externalId, null);

    const again = await postPublication(
      authedRequest("http://localhost/api", authCookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salesChannelId: channel.id }),
      }),
      { params: Promise.resolve({ id: listing.listing.id }) },
    );
    assert.equal(again.status, 200);
  });

  it("GET не отдаёт Publication чужой карточки", async () => {
    const first = await resetFixtures();
    const listingA = await createLongTermListing({ propertyId: first.property.id });
    const created = await createPublication({
      longTermListingId: listingA.listing.id,
      salesChannelId: first.channel.id,
    });
    const secondProperty = await prisma.property.create({
      data: {
        name: "Другой объект",
        slug: `other-${Date.now()}`,
        type: "APARTMENT",
        status: "ACTIVE",
        address: "ул. Другая, 2",
        city: "Тестовый город",
        district: "Б",
        area: 30,
        rooms: 1,
        bedrooms: 1,
        bathrooms: 1,
        guests: 2,
        description: "Тест",
        shortDescription: "Тест",
        ownerName: "Владелец",
        ownerPhone: "+7 000 000-00-09",
        managementType: "OWN",
      },
    });
    const listingB = await createLongTermListing({ propertyId: secondProperty.id });
    const leaked = await getPublication(
      authedRequest("http://localhost/api", authCookie),
      {
        params: Promise.resolve({
          id: listingB.listing.id,
          publicationId: created.publication.id,
        }),
      },
    );
    assert.equal(leaked.status, 404);

    const list = await getPublications(authedRequest("http://localhost/api", authCookie), {
      params: Promise.resolve({ id: listingA.listing.id }),
    });
    assert.equal(list.status, 200);
    const body = (await list.json()) as { publications: Array<{ id: string }> };
    assert.equal(body.publications.length, 1);
    assert.equal(serializePublication(created.publication).id, body.publications[0].id);
  });
});
