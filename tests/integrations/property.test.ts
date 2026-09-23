import "./helpers-preload";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createChannelListing } from "@/lib/channel-listings";
import { createLongTermListing } from "@/lib/long-term-listings";
import { PropertyError, deleteProperty } from "@/lib/properties";
import { createBooking } from "@/lib/bookings";
import { prisma } from "@/lib/prisma";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";

describe("properties", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  it("не удаляет объект с бронированием", async () => {
    const { channel, property } = await resetFixtures();
    const guest = await prisma.guest.create({ data: { firstName: "Гость" } });
    await createBooking({
      propertyId: property.id,
      guestId: guest.id,
      salesChannelId: channel.id,
      checkIn: "2026-09-01",
      checkOut: "2026-09-03",
      guestsCount: 1,
      totalAmount: 1000,
    });
    await assert.rejects(
      () => deleteProperty(property.id),
      (error: unknown) => error instanceof PropertyError && error.code === "CONFLICT",
    );
    assert.equal(await prisma.property.count({ where: { id: property.id } }), 1);
  });

  it("не удаляет объект с ChannelListing", async () => {
    const { channel, property } = await resetFixtures();
    await createChannelListing(property.id, {
      salesChannelId: channel.id,
      externalId: "333333333",
      externalUrl: "https://www.avito.ru/test/333333333",
    });
    await assert.rejects(
      () => deleteProperty(property.id),
      (error: unknown) =>
        error instanceof PropertyError &&
        error.message.includes("каналов"),
    );
    assert.equal(await prisma.channelListing.count({ where: { propertyId: property.id } }), 1);
  });

  it("не удаляет объект с LongTermListing", async () => {
    const { property } = await resetFixtures();
    await createLongTermListing({ propertyId: property.id });
    await assert.rejects(
      () => deleteProperty(property.id),
      (error: unknown) =>
        error instanceof PropertyError &&
        error.message.includes("долгосрочной"),
    );
    assert.equal(await prisma.longTermListing.count({ where: { propertyId: property.id } }), 1);
  });

  it("удаляет свободный объект", async () => {
    const { property } = await resetFixtures();
    assert.equal(await deleteProperty(property.id), true);
    assert.equal(await prisma.property.count({ where: { id: property.id } }), 0);
  });
});
