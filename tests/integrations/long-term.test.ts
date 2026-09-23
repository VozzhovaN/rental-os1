import "./helpers-preload";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createChannelListing } from "@/lib/channel-listings";
import { getDashboardData } from "@/lib/dashboard";
import {
  archiveLongTermListing,
  createLongTermListing,
  getLongTermListingById,
  LongTermListingError,
  replaceLongTermPhotos,
  updateLongTermListing,
} from "@/lib/long-term-listings";
import { prisma } from "@/lib/prisma";
import { createPropertyPhoto } from "@/lib/property-photos";
import {
  longTermListingUpdateFromFormData,
  parseUpdateLongTermListing,
  updateLongTermListingSchema,
} from "@/lib/validations/long-term-listing";
import { PATCH as patchLongTermListing, GET as getLongTermListing } from "@/app/api/long-term-listings/[id]/route";
import { authedRequest, createTestSessionCookie } from "../helpers/auth";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";

describe("long-term listings", () => {
  let authCookie: string;

  before(async () => {
    await prepareTestDatabase();
    const session = await createTestSessionCookie();
    authCookie = session.cookie;
  });

  it("создаёт карточку и не дублирует Property", async () => {
    const { property } = await resetFixtures();
    const first = await createLongTermListing({ propertyId: property.id });
    assert.equal(first.created, true);
    const second = await createLongTermListing({ propertyId: property.id });
    assert.equal(second.created, false);
    assert.equal(second.listing.id, first.listing.id);
    assert.equal(await prisma.longTermListing.count(), 1);
    assert.equal(await prisma.property.count({ where: { id: property.id } }), 1);
  });

  it("не копирует Property.monthlyPrice в LongTermListing", async () => {
    const { property } = await resetFixtures();
    await prisma.property.update({
      where: { id: property.id },
      data: { monthlyPrice: 99000 },
    });
    const created = await createLongTermListing({ propertyId: property.id });
    assert.equal(created.created, true);
    assert.equal(created.listing.monthlyPrice, 0);
    const source = await prisma.property.findUnique({ where: { id: property.id } });
    assert.equal(source?.monthlyPrice, 99000);
  });

  it("редактирует цену, описание и спецпредложение", async () => {
    const { property } = await resetFixtures();
    const created = await createLongTermListing({ propertyId: property.id });
    const updated = await updateLongTermListing(created.listing.id, {
      monthlyPrice: 70000,
      specialOfferPrice: 65000,
      specialOfferText: "Скидка при аренде от 6 месяцев",
      description: "Новый рекламный текст",
      marketingTitle: "Специальное предложение",
    });
    assert.equal(updated.monthlyPrice, 70000);
    assert.equal(updated.specialOfferPrice, 65000);
    assert.equal(updated.specialOfferText, "Скидка при аренде от 6 месяцев");
    assert.equal(updated.description, "Новый рекламный текст");
    const source = await prisma.property.findUnique({ where: { id: property.id } });
    assert.equal(source?.description, "Тест");
  });

  it("меняет статусы pause/activate/archive без удаления Property", async () => {
    const { property } = await resetFixtures();
    const created = await createLongTermListing({ propertyId: property.id });
    const paused = await updateLongTermListing(created.listing.id, { status: "PAUSED" });
    assert.equal(paused.status, "PAUSED");
    const activated = await updateLongTermListing(created.listing.id, { status: "ACTIVE" });
    assert.equal(activated.status, "ACTIVE");
    const archived = await archiveLongTermListing(created.listing.id);
    assert.equal(archived.status, "ARCHIVED");
    assert.equal(await prisma.property.count({ where: { id: property.id } }), 1);
    assert.equal(await prisma.longTermListing.count({ where: { id: created.listing.id } }), 1);
  });

  it("не создаёт Booking и не попадает в KPI Dashboard", async () => {
    const { property } = await resetFixtures();
    const bookingsBefore = await prisma.booking.count();
    await createLongTermListing({ propertyId: property.id });
    assert.equal(await prisma.booking.count(), bookingsBefore);
    const dashboard = await getDashboardData({
      year: 2026,
      month: 9,
      date: "2026-09-02",
    });
    assert.equal(dashboard.bookings.length, 0);
    assert.equal(
      dashboard.stats.bookings,
      0,
    );
  });

  it("выбирает фотографии и меняет порядок", async () => {
    const { property } = await resetFixtures();
    const created = await createLongTermListing({ propertyId: property.id });
    const first = await createPropertyPhoto(property.id, { url: "https://example.com/a.jpg" });
    const second = await createPropertyPhoto(property.id, { url: "https://example.com/b.jpg" });
    const listing = await replaceLongTermPhotos(created.listing.id, {
      items: [
        { photoId: second.id, sortOrder: 0, included: true },
        { photoId: first.id, sortOrder: 1, included: false },
      ],
    });
    assert.equal(listing?.photos[0].photoId, second.id);
    assert.equal(listing?.photos[0].included, true);
    assert.equal(listing?.photos[1].photoId, first.id);
    assert.equal(listing?.photos[1].included, false);
  });

  it("не ломает посуточный ChannelListing Авито", async () => {
    const { channel, property } = await resetFixtures();
    const listing = await createChannelListing(property.id, {
      salesChannelId: channel.id,
      externalId: "111111111",
      externalUrl: "https://www.avito.ru/test/111111111",
    });
    await createLongTermListing({ propertyId: property.id });
    const stillThere = await prisma.channelListing.findUnique({ where: { id: listing.id } });
    assert.equal(stillThere?.status, "ACTIVE");
    assert.equal(stillThere?.externalId, "111111111");
  });

  it("возвращает карточку по id", async () => {
    const { property } = await resetFixtures();
    const created = await createLongTermListing({ propertyId: property.id });
    const listing = await getLongTermListingById(created.listing.id);
    assert.equal(listing?.id, created.listing.id);
    assert.equal(listing?.propertyId, property.id);
  });

  it("отклоняет невалидную цену, срок и статус", () => {
    const invalidPrices = [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, -1, "", "70000"];
    for (const monthlyPrice of invalidPrices) {
      if (monthlyPrice === undefined) {
        continue;
      }
      const parsed = updateLongTermListingSchema.safeParse({ monthlyPrice });
      assert.equal(parsed.success, false, `monthlyPrice=${String(monthlyPrice)} должен быть отклонён`);
    }

    assert.equal(updateLongTermListingSchema.safeParse({ deposit: -10 }).success, false);
    assert.equal(updateLongTermListingSchema.safeParse({ commission: Number.NaN }).success, false);
    assert.equal(updateLongTermListingSchema.safeParse({ minimumRentalPeriod: 0 }).success, false);
    assert.equal(updateLongTermListingSchema.safeParse({ minimumRentalPeriod: -1 }).success, false);
    assert.equal(updateLongTermListingSchema.safeParse({ status: "HIDDEN" }).success, false);
    assert.equal(updateLongTermListingSchema.safeParse({ propertyId: "hack" }).success, false);
    assert.equal(updateLongTermListingSchema.safeParse({ monthlyPrice: 70000 }).success, true);
  });

  it("возвращает ошибку, если Property не найден", async () => {
    await assert.rejects(
      () => createLongTermListing({ propertyId: "missing-property" }),
      (error: unknown) =>
        error instanceof LongTermListingError && error.code === "NOT_FOUND" && error.message === "Объект не найден",
    );
  });

  it("переводит DRAFT → ACTIVE и не восстанавливает ARCHIVED", async () => {
    const { property } = await resetFixtures();
    const created = await createLongTermListing({ propertyId: property.id });
    assert.equal(created.listing.status, "DRAFT");
    const activated = await updateLongTermListing(created.listing.id, { status: "ACTIVE" });
    assert.equal(activated.status, "ACTIVE");
    await archiveLongTermListing(created.listing.id);
    await assert.rejects(
      () => updateLongTermListing(created.listing.id, { status: "ACTIVE" }),
      (error: unknown) =>
        error instanceof LongTermListingError &&
        error.code === "VALIDATION" &&
        error.message === "Архивная карточка не может быть восстановлена",
    );
    const stillArchived = await archiveLongTermListing(created.listing.id);
    assert.equal(stillArchived.status, "ARCHIVED");
    assert.equal(await prisma.longTermListing.count({ where: { id: created.listing.id } }), 1);
  });

  it("удаляет связь фото, не дублируя файл PropertyPhoto", async () => {
    const { property } = await resetFixtures();
    const created = await createLongTermListing({ propertyId: property.id });
    const photo = await createPropertyPhoto(property.id, { url: "https://example.com/keep.jpg" });
    await replaceLongTermPhotos(created.listing.id, {
      items: [{ photoId: photo.id, sortOrder: 0, included: true }],
    });
    const cleared = await replaceLongTermPhotos(created.listing.id, { items: [] });
    assert.equal(cleared?.photos.length, 0);
    assert.equal(await prisma.propertyPhoto.count({ where: { id: photo.id } }), 1);
    await assert.rejects(
      () =>
        replaceLongTermPhotos(created.listing.id, {
          items: [
            { photoId: photo.id, sortOrder: 0, included: true },
            { photoId: photo.id, sortOrder: 1, included: false },
          ],
        }),
      (error: unknown) => error instanceof LongTermListingError && error.code === "VALIDATION",
    );
  });

  it("архивация не трогает Property, Booking, Guest и ChannelListing", async () => {
    const { channel, property } = await resetFixtures();
    const guest = await prisma.guest.create({
      data: { firstName: "Анна", phone: "+70000000000" },
    });
    const history = await prisma.guestHistory.create({
      data: { guestId: guest.id, type: "NOTE", title: "Заметка" },
    });
    const channelListing = await createChannelListing(property.id, {
      salesChannelId: channel.id,
      externalId: "222222222",
      externalUrl: "https://www.avito.ru/test/222222222",
    });
    const booking = await prisma.booking.create({
      data: {
        propertyId: property.id,
        guestId: guest.id,
        salesChannelId: channel.id,
        channelListingId: channelListing.id,
        checkIn: new Date("2026-09-10T00:00:00.000Z"),
        checkOut: new Date("2026-09-12T00:00:00.000Z"),
        guestsCount: 2,
        totalAmount: 8000,
        status: "CONFIRMED",
        comment: "короткая бронь",
      },
    });
    const created = await createLongTermListing({ propertyId: property.id });
    await archiveLongTermListing(created.listing.id);

    assert.equal(await prisma.property.count({ where: { id: property.id } }), 1);
    assert.equal(await prisma.longTermListing.count({ where: { id: created.listing.id, status: "ARCHIVED" } }), 1);
    const bookingAfter = await prisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(bookingAfter?.totalAmount, 8000);
    assert.equal(bookingAfter?.status, "CONFIRMED");
    assert.equal(bookingAfter?.comment, "короткая бронь");
    assert.equal(await prisma.guest.count({ where: { id: guest.id } }), 1);
    assert.equal(await prisma.guestHistory.count({ where: { id: history.id } }), 1);
    const listingAfter = await prisma.channelListing.findUnique({ where: { id: channelListing.id } });
    assert.equal(listingAfter?.externalId, "222222222");
    assert.equal(listingAfter?.status, "ACTIVE");
  });

  it("не позволяет сменить propertyId через mass assignment", async () => {
    const { property } = await resetFixtures();
    const other = await prisma.property.create({
      data: {
        name: "Чужой объект",
        slug: `other-${Date.now()}`,
        type: "APARTMENT",
        status: "ACTIVE",
        address: "ул. Другая, д. 2",
        city: "Тестовый город",
        district: "Район Б",
        area: 30,
        rooms: 1,
        bedrooms: 1,
        bathrooms: 1,
        guests: 2,
        description: "Чужое",
        shortDescription: "Чужое",
        ownerName: "Другой",
        ownerPhone: "+7 000 000-00-02",
        managementType: "OWN",
      },
    });
    const created = await createLongTermListing({ propertyId: property.id });
    const updated = await updateLongTermListing(created.listing.id, {
      monthlyPrice: 50000,
      propertyId: other.id,
    } as never);
    assert.equal(updated.propertyId, property.id);
    assert.equal(updated.monthlyPrice, 50000);
  });

  it("PATCH без propertyId сохраняет карточку, PATCH с propertyId даёт 400", async () => {
    const { property } = await resetFixtures();
    const created = await createLongTermListing({ propertyId: property.id });
    const other = await prisma.property.create({
      data: {
        name: "Другой объект",
        slug: `other-patch-${Date.now()}`,
        type: "APARTMENT",
        status: "ACTIVE",
        address: "ул. Другая, д. 3",
        city: "Тестовый город",
        district: "Район В",
        area: 33,
        rooms: 1,
        bedrooms: 1,
        bathrooms: 1,
        guests: 2,
        description: "Чужое",
        shortDescription: "Чужое",
        ownerName: "Другой",
        ownerPhone: "+7 000 000-00-03",
        managementType: "OWN",
      },
    });

    const ok = await patchLongTermListing(
      authedRequest(`http://localhost/api/long-term-listings/${created.listing.id}`, authCookie, {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          monthlyPrice: 71000,
          description: "Обновлённое описание",
          specialOfferPrice: 68000,
          specialOfferText: "Спецпредложение",
          rentalTerms: "От 12 месяцев",
          status: "ACTIVE",
        }),
      }),
      { params: Promise.resolve({ id: created.listing.id }) },
    );
    assert.equal(ok.status, 200);
    const okBody = (await ok.json()) as { listing: { monthlyPrice: number; propertyId: string } };
    assert.equal(okBody.listing.monthlyPrice, 71000);
    assert.equal(okBody.listing.propertyId, property.id);

    const forbidden = await patchLongTermListing(
      authedRequest(`http://localhost/api/long-term-listings/${created.listing.id}`, authCookie, {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ propertyId: other.id, monthlyPrice: 1 }),
      }),
      { params: Promise.resolve({ id: created.listing.id }) },
    );
    assert.equal(forbidden.status, 400);
    const forbiddenText = Buffer.from(await forbidden.arrayBuffer()).toString("utf8");
    const forbiddenBody = JSON.parse(forbiddenText) as { error: string; details?: string[] };
    assert.equal(forbiddenBody.error, "Ошибка валидации");
    assert.ok(forbiddenBody.details?.some((item) => item.includes("propertyId")));
    assert.equal(forbiddenText.includes("�"), false);
    assert.ok(forbidden.headers.get("content-type")?.includes("charset=utf-8"));

    const unchanged = await prisma.longTermListing.findUnique({ where: { id: created.listing.id } });
    assert.equal(unchanged?.propertyId, property.id);
    assert.equal(unchanged?.monthlyPrice, 71000);
  });

  it("form DTO для PATCH не содержит propertyId", () => {
    const form = new FormData();
    form.set("propertyId", "should-not-be-sent");
    form.set("status", "ACTIVE");
    form.set("monthlyPrice", "65000");
    form.set("specialOfferPrice", "60000");
    form.set("specialOfferText", "Скидка");
    form.set("deposit", "65000");
    form.set("commission", "10");
    form.set("minimumRentalPeriod", "6");
    form.set("marketingTitle", "Заголовок");
    form.set("description", "Описание");
    form.set("rentalTerms", "Условия");
    form.set("infrastructureDescription", "");
    form.set("securityDescription", "");
    form.set("parkingDescription", "");
    form.set("transportDescription", "");
    form.set("advantagesDescription", "");

    const payload = longTermListingUpdateFromFormData(form);
    assert.equal("propertyId" in payload, false);
    assert.equal(payload.monthlyPrice, 65000);
    assert.equal(parseUpdateLongTermListing({ ...payload, propertyId: "hack" }).success, false);
  });

  it("GET после архивации возвращает карточку и UTF-8 ошибку для отсутствующей", async () => {
    const { property } = await resetFixtures();
    const created = await createLongTermListing({ propertyId: property.id });
    await archiveLongTermListing(created.listing.id);

    const archived = await getLongTermListing(
      authedRequest("http://localhost", authCookie),
      {
        params: Promise.resolve({ id: created.listing.id }),
      },
    );
    assert.equal(archived.status, 200);
    const archivedBody = (await archived.json()) as { listing: { status: string } };
    assert.equal(archivedBody.listing.status, "ARCHIVED");
    assert.equal(await prisma.longTermListing.count({ where: { id: created.listing.id } }), 1);

    const missing = await getLongTermListing(
      authedRequest("http://localhost", authCookie),
      {
        params: Promise.resolve({ id: "missing-listing" }),
      },
    );
    assert.equal(missing.status, 404);
    const missingText = Buffer.from(await missing.arrayBuffer()).toString("utf8");
    assert.equal(JSON.parse(missingText).error, "Карточка долгосрочной аренды не найдена");
    assert.equal(missingText.includes("�"), false);
    assert.ok(missing.headers.get("content-type")?.includes("charset=utf-8"));
  });

  it("не позволяет привязать фотографию чужого Property", async () => {
    const { property } = await resetFixtures();
    const other = await prisma.property.create({
      data: {
        name: "Чужой для фото",
        slug: `photo-idor-${Date.now()}`,
        type: "APARTMENT",
        status: "ACTIVE",
        address: "ул. Чужая, д. 4",
        city: "Тестовый город",
        district: "Район Г",
        area: 20,
        rooms: 1,
        bedrooms: 1,
        bathrooms: 1,
        guests: 2,
        description: "Чужое",
        shortDescription: "Чужое",
        ownerName: "Другой",
        ownerPhone: "+7 000 000-00-04",
        managementType: "OWN",
      },
    });
    const created = await createLongTermListing({ propertyId: property.id });
    const foreignPhoto = await createPropertyPhoto(other.id, { url: "https://example.com/foreign.jpg" });
    await assert.rejects(
      () =>
        replaceLongTermPhotos(created.listing.id, {
          items: [{ photoId: foreignPhoto.id, sortOrder: 0, included: true }],
        }),
      (error: unknown) => error instanceof LongTermListingError && error.code === "VALIDATION",
    );
  });
});
