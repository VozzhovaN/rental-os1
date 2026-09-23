import "./helpers-preload";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
  createChannelListing,
  setChannelListingStatus,
} from "@/lib/channel-listings";
import { prisma } from "@/lib/prisma";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";

describe("avito channel listing disconnect", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  it("отключает listing без удаления Property/Booking/Guest", async () => {
    const { channel, property } = await resetFixtures();
    const guest = await prisma.guest.create({
      data: { firstName: "Гость", phone: "+70000000001" },
    });
    const booking = await prisma.booking.create({
      data: {
        propertyId: property.id,
        guestId: guest.id,
        salesChannelId: channel.id,
        checkIn: new Date(Date.UTC(2026, 10, 1)),
        checkOut: new Date(Date.UTC(2026, 10, 5)),
        guestsCount: 1,
        totalAmount: 10000,
        status: "CONFIRMED",
      },
    });
    const listing = await createChannelListing(property.id, {
      salesChannelId: channel.id,
      externalId: "111111111",
      externalUrl: "https://www.avito.ru/test/111111111",
    });

    const propertyBefore = await prisma.property.findUnique({ where: { id: property.id } });
    const bookingBefore = await prisma.booking.findUnique({ where: { id: booking.id } });
    const guestBefore = await prisma.guest.findUnique({ where: { id: guest.id } });

    const disabled = await setChannelListingStatus(property.id, listing.id, "INACTIVE");
    assert.equal(disabled.status, "INACTIVE");
    assert.equal(await prisma.channelListing.count({ where: { id: listing.id } }), 1);

    const propertyAfter = await prisma.property.findUnique({ where: { id: property.id } });
    const bookingAfter = await prisma.booking.findUnique({ where: { id: booking.id } });
    const guestAfter = await prisma.guest.findUnique({ where: { id: guest.id } });
    assert.deepEqual(propertyAfter, propertyBefore);
    assert.deepEqual(bookingAfter, bookingBefore);
    assert.deepEqual(guestAfter, guestBefore);

    const enabled = await setChannelListingStatus(property.id, listing.id, "ACTIVE");
    assert.equal(enabled.status, "ACTIVE");
    assert.equal(enabled.id, listing.id);
  });

  it("disconnectAvito переводит ACTIVE ChannelListing в INACTIVE без удаления", async () => {
    const { channel, property } = await resetFixtures();
    const { connectAvito, disconnectAvito } = await import("@/lib/integrations/avito-service");
    await connectAvito();
    const listing = await createChannelListing(property.id, {
      salesChannelId: channel.id,
      externalId: "222222222",
      externalUrl: "https://www.avito.ru/test/222222222",
    });
    assert.equal(listing.status, "ACTIVE");

    await disconnectAvito();

    const after = await prisma.channelListing.findUnique({ where: { id: listing.id } });
    assert.ok(after);
    assert.equal(after.status, "INACTIVE");
    assert.equal(after.syncStatus, "NOT_CONNECTED");
    assert.equal(after.externalId, "222222222");
  });

  it("по-прежнему запрещает дубликат externalId", async () => {
    const { channel, property } = await resetFixtures();
    const second = await prisma.property.create({
      data: {
        name: "Второй объект",
        slug: `second-${Date.now()}`,
        type: "STUDIO",
        status: "ACTIVE",
        address: "ул. 2",
        city: "Тестовый город",
        district: "Б",
        area: 20,
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
      externalUrl: null,
    });
    await assert.rejects(
      () =>
        createChannelListing(second.id, {
          salesChannelId: channel.id,
          externalId: "111111111",
          externalUrl: null,
        }),
      (error: unknown) =>
        error instanceof Error &&
        error.message === "Это объявление Авито уже привязано к другому объекту.",
    );
  });
});
