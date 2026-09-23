import "./helpers-preload";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
  BookingError,
  checkInBooking,
  checkOutBooking,
  createBooking,
  deleteBooking,
  getAllowedBookingStatuses,
  updateBooking,
} from "@/lib/bookings";
import { prisma } from "@/lib/prisma";
import { createBookingSchema } from "@/lib/validations/guest";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";

describe("bookings", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  async function createGuest() {
    return prisma.guest.create({
      data: { firstName: "Анна", phone: "+70000000000" },
    });
  }

  it("создаёт бронь и отклоняет пересечение дат", async () => {
    const { channel, property } = await resetFixtures();
    const guest = await createGuest();
    const first = await createBooking({
      propertyId: property.id,
      guestId: guest.id,
      salesChannelId: channel.id,
      checkIn: "2026-09-10",
      checkOut: "2026-09-14",
      guestsCount: 2,
      totalAmount: 8000,
      status: "CONFIRMED",
    });
    assert.equal(first.status, "CONFIRMED");

    await assert.rejects(
      () =>
        createBooking({
          propertyId: property.id,
          guestId: guest.id,
          salesChannelId: channel.id,
          checkIn: "2026-09-13",
          checkOut: "2026-09-16",
          guestsCount: 1,
          totalAmount: 3000,
        }),
      (error: unknown) => error instanceof BookingError && error.code === "CONFLICT",
    );
  });

  it("разрешает same-day turnover на границе выезда", async () => {
    const { channel, property } = await resetFixtures();
    const guest = await createGuest();
    await createBooking({
      propertyId: property.id,
      guestId: guest.id,
      salesChannelId: channel.id,
      checkIn: "2026-09-10",
      checkOut: "2026-09-14",
      guestsCount: 1,
      totalAmount: 4000,
      status: "CONFIRMED",
    });
    const next = await createBooking({
      propertyId: property.id,
      guestId: guest.id,
      salesChannelId: channel.id,
      checkIn: "2026-09-14",
      checkOut: "2026-09-16",
      guestsCount: 1,
      totalAmount: 2000,
      status: "PENDING",
    });
    assert.equal(next.status, "PENDING");
  });

  it("не создаёт бронь со статусом CANCELLED", () => {
    assert.equal(createBookingSchema.safeParse({
      propertyId: "p",
      guestId: "g",
      salesChannelId: "c",
      checkIn: "2026-09-10",
      checkOut: "2026-09-12",
      guestsCount: 1,
      totalAmount: 1000,
      status: "CANCELLED",
    }).success, false);
  });

  it("check-in / check-out и запрещает восстановление COMPLETED", async () => {
    const { channel, property } = await resetFixtures();
    const guest = await createGuest();
    const created = await createBooking({
      propertyId: property.id,
      guestId: guest.id,
      salesChannelId: channel.id,
      checkIn: "2026-09-20",
      checkOut: "2026-09-22",
      guestsCount: 1,
      totalAmount: 2000,
    });
    const checkedIn = await checkInBooking(created.id);
    assert.equal(checkedIn.status, "CONFIRMED");
    const checkedOut = await checkOutBooking(checkedIn.id);
    assert.equal(checkedOut.status, "COMPLETED");
    await assert.rejects(
      () => checkInBooking(checkedOut.id),
      (error: unknown) => error instanceof BookingError && error.code === "VALIDATION",
    );
    await assert.rejects(
      () => updateBooking(checkedOut.id, { status: "CONFIRMED" }),
      (error: unknown) => error instanceof BookingError && error.code === "VALIDATION",
    );
  });

  it("отмена не удаляет запись и освобождает даты", async () => {
    const { channel, property } = await resetFixtures();
    const guest = await createGuest();
    const created = await createBooking({
      propertyId: property.id,
      guestId: guest.id,
      salesChannelId: channel.id,
      checkIn: "2026-10-01",
      checkOut: "2026-10-05",
      guestsCount: 1,
      totalAmount: 5000,
      status: "CONFIRMED",
    });
    const cancelled = await updateBooking(created.id, { status: "CANCELLED" });
    assert.equal(cancelled.status, "CANCELLED");
    const replacement = await createBooking({
      propertyId: property.id,
      guestId: guest.id,
      salesChannelId: channel.id,
      checkIn: "2026-10-01",
      checkOut: "2026-10-05",
      guestsCount: 1,
      totalAmount: 5000,
    });
    assert.equal(replacement.status, "PENDING");
  });

  it("не удаляет импортированную бронь", async () => {
    const { channel, property } = await resetFixtures();
    const guest = await createGuest();
    const created = await createBooking({
      propertyId: property.id,
      guestId: guest.id,
      salesChannelId: channel.id,
      checkIn: "2026-11-01",
      checkOut: "2026-11-03",
      guestsCount: 1,
      totalAmount: 2000,
    });
    await prisma.externalBooking.create({
      data: {
        bookingId: created.id,
        salesChannelId: channel.id,
        externalId: "ext-1",
      },
    });
    await assert.rejects(
      () => deleteBooking(created.id),
      (error: unknown) => error instanceof BookingError && error.code === "CONFLICT",
    );
    assert.equal(await prisma.booking.count({ where: { id: created.id } }), 1);
  });

  it("отклоняет превышение вместимости и неактивный объект", async () => {
    const { channel, property } = await resetFixtures();
    const guest = await createGuest();
    await assert.rejects(
      () =>
        createBooking({
          propertyId: property.id,
          guestId: guest.id,
          salesChannelId: channel.id,
          checkIn: "2026-12-01",
          checkOut: "2026-12-03",
          guestsCount: 99,
          totalAmount: 1000,
        }),
      (error: unknown) => error instanceof BookingError && error.code === "CAPACITY",
    );
    await prisma.property.update({ where: { id: property.id }, data: { status: "INACTIVE" } });
    await assert.rejects(
      () =>
        createBooking({
          propertyId: property.id,
          guestId: guest.id,
          salesChannelId: channel.id,
          checkIn: "2026-12-01",
          checkOut: "2026-12-03",
          guestsCount: 1,
          totalAmount: 1000,
        }),
      (error: unknown) => error instanceof BookingError && error.code === "VALIDATION",
    );
  });

  it("getAllowedBookingStatuses mirrors FSM (no illegal options for terminal)", () => {
    assert.deepEqual(getAllowedBookingStatuses("COMPLETED"), ["COMPLETED"]);
    assert.deepEqual(getAllowedBookingStatuses("CANCELLED"), ["CANCELLED"]);
    assert.ok(getAllowedBookingStatuses("PENDING").includes("CONFIRMED"));
    assert.ok(getAllowedBookingStatuses("CONFIRMED").includes("CANCELLED"));
    assert.ok(!getAllowedBookingStatuses("CONFIRMED").includes("PENDING"));
  });
});
