import "./helpers-preload";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createBooking, updateBooking } from "@/lib/bookings";
import { getDashboardData, sumDashboardIncome } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";

describe("dashboard income", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  it("считает CONFIRMED+COMPLETED и не включает PENDING/CANCELLED", () => {
    assert.equal(
      sumDashboardIncome([
        { status: "PENDING", totalAmount: 10000 },
        { status: "CONFIRMED", totalAmount: 20000 },
        { status: "COMPLETED", totalAmount: 30000 },
        { status: "CANCELLED", totalAmount: 40000 },
      ]),
      50000,
    );
  });

  it("month view, property filter и status filter не меняют правило дохода", async () => {
    const { channel, property } = await resetFixtures();
    const guest = await prisma.guest.create({
      data: { firstName: "Даша", phone: "+70000000010" },
    });
    const other = await prisma.property.create({
      data: {
        name: "Второй объект",
        slug: `second-object-${Date.now()}`,
        type: "APARTMENT",
        status: "ACTIVE",
        address: "ул. Вторая, д. 2",
        city: "Тестовый город",
        district: "Район Б",
        area: 50,
        rooms: 2,
        bedrooms: 1,
        bathrooms: 1,
        guests: 3,
        description: "Тест",
        shortDescription: "Тест",
        ownerName: "Владелец",
        ownerPhone: "+7 000 000-00-02",
        managementType: "OWN",
      },
    });

    await createBooking({
      propertyId: property.id,
      guestId: guest.id,
      salesChannelId: channel.id,
      checkIn: "2026-09-01",
      checkOut: "2026-09-03",
      guestsCount: 1,
      totalAmount: 10000,
      status: "PENDING",
    });
    await createBooking({
      propertyId: property.id,
      guestId: guest.id,
      salesChannelId: channel.id,
      checkIn: "2026-09-03",
      checkOut: "2026-09-05",
      guestsCount: 1,
      totalAmount: 20000,
      status: "CONFIRMED",
    });
    const completed = await createBooking({
      propertyId: property.id,
      guestId: guest.id,
      salesChannelId: channel.id,
      checkIn: "2026-09-05",
      checkOut: "2026-09-07",
      guestsCount: 1,
      totalAmount: 30000,
      status: "CONFIRMED",
    });
    await updateBooking(completed.id, { status: "COMPLETED" });
    const cancelled = await createBooking({
      propertyId: property.id,
      guestId: guest.id,
      salesChannelId: channel.id,
      checkIn: "2026-09-07",
      checkOut: "2026-09-09",
      guestsCount: 1,
      totalAmount: 40000,
      status: "CONFIRMED",
    });
    await updateBooking(cancelled.id, { status: "CANCELLED" });
    await createBooking({
      propertyId: property.id,
      guestId: guest.id,
      salesChannelId: channel.id,
      checkIn: "2026-10-01",
      checkOut: "2026-10-04",
      guestsCount: 1,
      totalAmount: 50000,
      status: "CONFIRMED",
    });
    await createBooking({
      propertyId: other.id,
      guestId: guest.id,
      salesChannelId: channel.id,
      checkIn: "2026-09-10",
      checkOut: "2026-09-12",
      guestsCount: 1,
      totalAmount: 15000,
      status: "CONFIRMED",
    });

    const month = await getDashboardData({
      year: 2026,
      month: 9,
      date: "2026-09-02",
    });
    assert.equal(month.stats.bookings, 4);
    assert.equal(month.stats.income, 65000);
    assert.ok(month.bookings.every((booking) => booking.status !== "CANCELLED"));

    const pendingOnly = await getDashboardData({
      year: 2026,
      month: 9,
      date: "2026-09-02",
      bookingStatus: "PENDING",
    });
    assert.equal(pendingOnly.stats.bookings, 1);
    assert.equal(pendingOnly.stats.income, 0);

    const confirmedOnly = await getDashboardData({
      year: 2026,
      month: 9,
      date: "2026-09-02",
      bookingStatus: "CONFIRMED",
    });
    assert.equal(confirmedOnly.stats.bookings, 2);
    assert.equal(confirmedOnly.stats.income, 35000);

    const completedOnly = await getDashboardData({
      year: 2026,
      month: 9,
      date: "2026-09-02",
      bookingStatus: "COMPLETED",
    });
    assert.equal(completedOnly.stats.bookings, 1);
    assert.equal(completedOnly.stats.income, 30000);

    const propertyA = await getDashboardData({
      year: 2026,
      month: 9,
      date: "2026-09-02",
      propertyId: property.id,
    });
    assert.equal(propertyA.stats.bookings, 3);
    assert.equal(propertyA.stats.income, 50000);

    const october = await getDashboardData({
      year: 2026,
      month: 10,
      date: "2026-10-01",
    });
    assert.equal(october.stats.bookings, 1);
    assert.equal(october.stats.income, 50000);
  });
});
