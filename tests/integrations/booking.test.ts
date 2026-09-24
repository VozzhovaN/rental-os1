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
    assert.ok(!getAllowedBookingStatuses("PENDING").includes("COMPLETED"));
    assert.ok(getAllowedBookingStatuses("CONFIRMED").includes("CANCELLED"));
    assert.ok(!getAllowedBookingStatuses("CONFIRMED").includes("PENDING"));
  });

  it("COMPLETED освобождает даты для новой брони", async () => {
    const { channel, property } = await resetFixtures();
    const guest = await createGuest();
    const created = await createBooking({
      propertyId: property.id,
      guestId: guest.id,
      salesChannelId: channel.id,
      checkIn: "2026-08-01",
      checkOut: "2026-08-10",
      guestsCount: 1,
      totalAmount: 9000,
      status: "PENDING",
    });
    await checkInBooking(created.id);
    await checkOutBooking(created.id);
    const completed = await prisma.booking.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(completed.status, "COMPLETED");

    const replacement = await createBooking({
      propertyId: property.id,
      guestId: guest.id,
      salesChannelId: channel.id,
      checkIn: "2026-08-05",
      checkOut: "2026-08-12",
      guestsCount: 1,
      totalAmount: 7000,
    });
    assert.equal(replacement.status, "PENDING");
  });

  it("check-out запрещён из PENDING (нужен check-in → CONFIRMED)", async () => {
    const { channel, property } = await resetFixtures();
    const guest = await createGuest();
    const created = await createBooking({
      propertyId: property.id,
      guestId: guest.id,
      salesChannelId: channel.id,
      checkIn: "2026-07-01",
      checkOut: "2026-07-03",
      guestsCount: 1,
      totalAmount: 2000,
    });
    assert.equal(created.status, "PENDING");
    await assert.rejects(
      () => checkOutBooking(created.id),
      (error: unknown) => error instanceof BookingError && error.code === "VALIDATION",
    );
    await assert.rejects(
      () => updateBooking(created.id, { status: "COMPLETED" }),
      (error: unknown) => error instanceof BookingError && error.code === "VALIDATION",
    );
  });

  it("перенос брони на другого гостя пишет историю обоим", async () => {
    const { channel, property } = await resetFixtures();
    const guestA = await createGuest();
    const guestB = await prisma.guest.create({
      data: { firstName: "Борис", phone: "+70000000001" },
    });
    const created = await createBooking({
      propertyId: property.id,
      guestId: guestA.id,
      salesChannelId: channel.id,
      checkIn: "2026-06-01",
      checkOut: "2026-06-03",
      guestsCount: 1,
      totalAmount: 3000,
    });
    await updateBooking(created.id, { guestId: guestB.id });

    const historyA = await prisma.guestHistory.findMany({
      where: { guestId: guestA.id },
      orderBy: { createdAt: "asc" },
    });
    const historyB = await prisma.guestHistory.findMany({
      where: { guestId: guestB.id },
      orderBy: { createdAt: "asc" },
    });
    assert.ok(historyA.some((h) => h.title.includes("перенесено")));
    assert.ok(historyB.some((h) => h.type === "BOOKING_UPDATED"));
  });
});
