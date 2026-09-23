import "./helpers-preload";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { resetMockAvitoAdapter } from "@/lib/integrations/adapters";
import { connectAvito } from "@/lib/integrations/avito-service";
import { createChannelListing } from "@/lib/channel-listings";
import { upsertAvitoConnection } from "@/lib/integrations/connections";
import { exportAvailabilityForProperty } from "@/lib/integrations/availability";
import { syncBookings } from "@/lib/integrations/avito-service";
import { prisma } from "@/lib/prisma";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";

describe("avito sync", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  it("подключает mock-адаптер и пишет CONNECTED", async () => {
    await resetFixtures();
    const adapter = resetMockAvitoAdapter();
    const result = await connectAvito();
    assert.equal(result.status, "CONNECTED");
    const connection = await prisma.integrationConnection.findFirst();
    assert.equal(connection?.status, "CONNECTED");
    assert.equal(adapter.status, "CONNECTED");
  });

  it("фиксирует ERROR при ошибке подключения", async () => {
    await resetFixtures();
    const adapter = resetMockAvitoAdapter();
    adapter.failConnect = true;
    await assert.rejects(() => connectAvito());
    const connection = await prisma.integrationConnection.findFirst();
    assert.equal(connection?.status, "ERROR");
  });

  it("привязывает объявление и отклоняет дубликат 409", async () => {
    const { channel, property } = await resetFixtures();
    const second = await prisma.property.create({
      data: {
        name: "Тестовый объект 2",
        slug: `test-object-2-${Date.now()}`,
        type: "STUDIO",
        status: "ACTIVE",
        address: "ул. Тестовая, д. 2",
        city: "Тестовый город",
        district: "Район Б",
        area: 26,
        rooms: 1,
        bedrooms: 1,
        bathrooms: 1,
        guests: 2,
        description: "Тест",
        shortDescription: "Тест",
        ownerName: "Владелец",
        ownerPhone: "+7 000 000-00-02",
        managementType: "OWN",
      },
    });

    await createChannelListing(property.id, {
      salesChannelId: channel.id,
      externalId: "111111111",
      externalUrl: "https://www.avito.ru/test/111111111",
    });

    await assert.rejects(
      () =>
        createChannelListing(second.id, {
          salesChannelId: channel.id,
          externalId: "111111111",
          externalUrl: "https://www.avito.ru/test/111111111",
        }),
      (error: unknown) =>
        error instanceof Error &&
        error.message === "Это объявление Авито уже привязано к другому объекту.",
    );
  });

  it("импортирует бронь идемпотентно и переиспользует гостя", async () => {
    const { channel, property } = await resetFixtures();
    const adapter = resetMockAvitoAdapter();
    await adapter.connect();
    await upsertAvitoConnection({
      status: "CONNECTED",
      providerAccountId: "mock-avito-account",
    });
    const listing = await createChannelListing(property.id, {
      salesChannelId: channel.id,
      externalId: "111111111",
      externalUrl: "https://www.avito.ru/test/111111111",
    });

    await prisma.guest.create({
      data: {
        firstName: "Иван",
        lastName: "Иванов",
        phone: "+79991234567",
        email: "ivan.avito@test.local",
      },
    });

    const first = await syncBookings(adapter);
    assert.equal(first.imported, 1);
    const guestsAfterFirst = await prisma.guest.count();
    const bookingsAfterFirst = await prisma.booking.count();
    const mapsAfterFirst = await prisma.externalBooking.count();

    const second = await syncBookings(adapter);
    assert.equal(second.updated, 1);
    assert.equal(second.imported, 0);
    assert.equal(await prisma.guest.count(), guestsAfterFirst);
    assert.equal(await prisma.booking.count(), bookingsAfterFirst);
    assert.equal(await prisma.externalBooking.count(), mapsAfterFirst);

    const booking = await prisma.booking.findFirst({ include: { guest: true } });
    assert.equal(booking?.channelListingId, listing.id);
    assert.equal(booking?.salesChannelId, channel.id);
    assert.equal(booking?.guest.phone?.includes("9991234567"), true);
  });

  it("создаёт гостя и историю при первом импорте", async () => {
    const { channel, property } = await resetFixtures();
    const adapter = resetMockAvitoAdapter();
    await adapter.connect();
    await upsertAvitoConnection({
      status: "CONNECTED",
      providerAccountId: "mock-avito-account",
    });
    await createChannelListing(property.id, {
      salesChannelId: channel.id,
      externalId: "111111111",
      externalUrl: "https://www.avito.ru/test/111111111",
    });

    const result = await syncBookings(adapter);
    assert.equal(result.imported, 1);
    const guest = await prisma.guest.findFirst({ include: { history: true } });
    assert.ok(guest);
    assert.equal(guest?.firstName, "Иван");
    assert.ok(guest?.history.some((entry) => entry.type === "CONTACT"));
    assert.ok(guest?.history.some((entry) => entry.type === "BOOKING_CREATED"));
  });

  it("отменяет CRM-бронь при canceled с Авито", async () => {
    const { channel, property } = await resetFixtures();
    const adapter = resetMockAvitoAdapter();
    await adapter.connect();
    await upsertAvitoConnection({
      status: "CONNECTED",
      providerAccountId: "mock-avito-account",
    });
    await createChannelListing(property.id, {
      salesChannelId: channel.id,
      externalId: "111111111",
      externalUrl: "https://www.avito.ru/test/111111111",
    });
    await syncBookings(adapter);
    adapter.bookings[0].status = "canceled";
    await syncBookings(adapter);
    const booking = await prisma.booking.findFirst();
    assert.equal(booking?.status, "CANCELLED");
    const map = await prisma.externalBooking.findFirst();
    assert.equal(map?.externalStatus, "canceled");
  });

  it("не создаёт бронь при конфликте дат", async () => {
    const { channel, property } = await resetFixtures();
    const adapter = resetMockAvitoAdapter();
    await adapter.connect();
    await upsertAvitoConnection({
      status: "CONNECTED",
      providerAccountId: "mock-avito-account",
    });
    await createChannelListing(property.id, {
      salesChannelId: channel.id,
      externalId: "111111111",
      externalUrl: "https://www.avito.ru/test/111111111",
    });
    const guest = await prisma.guest.create({
      data: { firstName: "CRM", lastName: "Гость", phone: "+70000000000" },
    });
    await prisma.booking.create({
      data: {
        propertyId: property.id,
        guestId: guest.id,
        salesChannelId: channel.id,
        checkIn: new Date(Date.UTC(2026, 10, 12)),
        checkOut: new Date(Date.UTC(2026, 10, 18)),
        guestsCount: 1,
        totalAmount: 1000,
        status: "CONFIRMED",
      },
    });

    const result = await syncBookings(adapter);
    assert.equal(result.errors, 1);
    assert.equal(await prisma.booking.count(), 1);
    assert.equal(await prisma.externalBooking.count(), 0);
    const log = await prisma.integrationSyncLog.findFirst({
      where: { status: "ERROR", entityType: "BOOKING" },
    });
    assert.ok(log?.errorMessage?.includes("Обнаружен конфликт бронирования"));
  });

  it("выгружает занятость CRM в адаптер", async () => {
    const { channel, property } = await resetFixtures();
    const adapter = resetMockAvitoAdapter();
    await adapter.connect();
    await upsertAvitoConnection({
      status: "CONNECTED",
      providerAccountId: "mock-avito-account",
    });
    await createChannelListing(property.id, {
      salesChannelId: channel.id,
      externalId: "111111111",
      externalUrl: "https://www.avito.ru/test/111111111",
    });
    const guest = await prisma.guest.create({
      data: { firstName: "CRM", lastName: "Гость" },
    });
    await prisma.booking.create({
      data: {
        propertyId: property.id,
        guestId: guest.id,
        salesChannelId: channel.id,
        checkIn: new Date(Date.UTC(2026, 11, 1)),
        checkOut: new Date(Date.UTC(2026, 11, 5)),
        guestsCount: 1,
        totalAmount: 4000,
        status: "CONFIRMED",
      },
    });

    const result = await exportAvailabilityForProperty(property.id, adapter);
    assert.equal(result.skipped, false);
    assert.equal(adapter.pushedAvailability.length, 1);
    assert.equal(adapter.pushedAvailability[0].listingId, "111111111");
    assert.equal(adapter.pushedAvailability[0].intervals.length, 1);
  });
});
