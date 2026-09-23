import {
  Prisma,
  type Booking,
  type BookingStatus,
  type ChannelListing,
  type Guest,
  type Property,
  type SalesChannel,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDate, parseDateOnly, toDateInputValue } from "@/lib/format";
import { createGuestHistory } from "@/lib/guest-history";
import { getGuestById } from "@/lib/guests";
import { getPropertyByIdOrSlug } from "@/lib/properties";
import { getSalesChannelById } from "@/lib/sales-channels";
import type { CreateBookingInput, UpdateBookingInput } from "@/lib/validations/guest";

const OCCUPYING_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "COMPLETED"];

const STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"],
  CONFIRMED: ["CONFIRMED", "COMPLETED", "CANCELLED"],
  COMPLETED: ["COMPLETED"],
  CANCELLED: ["CANCELLED"],
};

/** Allowed next statuses for CRM status select (includes current). */
export function getAllowedBookingStatuses(from: BookingStatus): BookingStatus[] {
  return STATUS_TRANSITIONS[from];
}

export class BookingError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "VALIDATION" | "CAPACITY" | "CONFLICT",
    readonly meta?: {
      propertyName?: string;
      checkIn?: string;
      checkOut?: string;
    },
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export type BookingFilters = {
  propertyId?: string;
  guestId?: string;
  salesChannelId?: string;
  status?: BookingStatus;
};

type PropertyPhotoCover = { url: string; isCover: boolean };
type ExternalBookingRef = { id: string };

type BookingRecord = Booking & {
  property: Pick<
    Property,
    "id" | "name" | "city" | "guests" | "status" | "type" | "area" | "address"
  > & {
    photos?: PropertyPhotoCover[];
  };
  guest: Pick<
    Guest,
    | "id"
    | "firstName"
    | "lastName"
    | "middleName"
    | "phone"
    | "email"
    | "messengerType"
    | "messengerContact"
  >;
  salesChannel: Pick<SalesChannel, "id" | "code" | "name">;
  channelListing: Pick<ChannelListing, "id" | "externalId" | "externalUrl" | "salesChannelId"> | null;
  externalBookings?: ExternalBookingRef[];
};

export type BookingDTO = {
  id: string;
  propertyId: string;
  guestId: string;
  salesChannelId: string;
  channelListingId: string | null;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  totalAmount: number;
  status: BookingStatus;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  isImported: boolean;
  coverPhotoUrl: string | null;
  property: Pick<Property, "id" | "name" | "city" | "guests" | "status" | "type" | "area" | "address">;
  guest: Pick<
    Guest,
    | "id"
    | "firstName"
    | "lastName"
    | "middleName"
    | "phone"
    | "email"
    | "messengerType"
    | "messengerContact"
  >;
  salesChannel: Pick<SalesChannel, "id" | "code" | "name">;
  channelListing: Pick<ChannelListing, "id" | "externalId" | "externalUrl" | "salesChannelId"> | null;
};

export type BookingListPaymentDTO = {
  paidAmount: number;
  refundedAmount: number;
  netPaidAmount: number;
};

export type BookingListItemDTO = BookingDTO & BookingListPaymentDTO;

const bookingInclude = {
  property: {
    select: {
      id: true,
      name: true,
      city: true,
      guests: true,
      status: true,
      type: true,
      area: true,
      address: true,
      photos: {
        orderBy: [{ isCover: "desc" as const }, { sortOrder: "asc" as const }],
        take: 1,
        select: { url: true, isCover: true },
      },
    },
  },
  guest: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleName: true,
      phone: true,
      email: true,
      messengerType: true,
      messengerContact: true,
    },
  },
  salesChannel: {
    select: { id: true, code: true, name: true },
  },
  channelListing: {
    select: { id: true, externalId: true, externalUrl: true, salesChannelId: true },
  },
  externalBookings: {
    select: { id: true },
    take: 1,
  },
};

function coverFromProperty(property: BookingRecord["property"]) {
  return property.photos?.[0]?.url ?? null;
}

export function serializeBooking(booking: BookingRecord): BookingDTO {
  const { photos: _photos, ...propertyRest } = booking.property as BookingRecord["property"] & {
    photos?: PropertyPhotoCover[];
  };
  void _photos;
  return {
    id: booking.id,
    propertyId: booking.propertyId,
    guestId: booking.guestId,
    salesChannelId: booking.salesChannelId,
    channelListingId: booking.channelListingId,
    checkIn: booking.checkIn.toISOString(),
    checkOut: booking.checkOut.toISOString(),
    guestsCount: booking.guestsCount,
    totalAmount: booking.totalAmount,
    status: booking.status,
    comment: booking.comment,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
    isImported: (booking.externalBookings?.length ?? 0) > 0,
    coverPhotoUrl: coverFromProperty(booking.property),
    property: propertyRest,
    guest: booking.guest,
    salesChannel: booking.salesChannel,
    channelListing: booking.channelListing,
  };
}

/** Batch payment aggregates for list UI — no full refund rows. */
export async function getBookingListPaymentSummaries(
  bookingIds: string[],
): Promise<Map<string, BookingListPaymentDTO>> {
  const map = new Map<string, BookingListPaymentDTO>();
  for (const id of bookingIds) {
    map.set(id, { paidAmount: 0, refundedAmount: 0, netPaidAmount: 0 });
  }
  if (bookingIds.length === 0) return map;

  const payments = await prisma.bookingPayment.findMany({
    where: { bookingId: { in: bookingIds } },
    select: {
      bookingId: true,
      amount: true,
      refunds: { select: { amount: true } },
    },
  });

  for (const payment of payments) {
    const current = map.get(payment.bookingId) ?? {
      paidAmount: 0,
      refundedAmount: 0,
      netPaidAmount: 0,
    };
    const refunded = payment.refunds.reduce((sum, r) => sum + r.amount, 0);
    current.paidAmount += payment.amount;
    current.refundedAmount += refunded;
    current.netPaidAmount = current.paidAmount - current.refundedAmount;
    map.set(payment.bookingId, current);
  }

  return map;
}

export function serializeBookingListItem(
  booking: BookingRecord,
  payments?: BookingListPaymentDTO,
): BookingListItemDTO {
  const base = serializeBooking(booking);
  const pay = payments ?? { paidAmount: 0, refundedAmount: 0, netPaidAmount: 0 };
  return { ...base, ...pay };
}

function toDate(value: string, field: string) {
  const date = parseDateOnly(value);

  if (!date) {
    throw new BookingError(`Некорректная дата: ${field}`, "VALIDATION");
  }

  return date;
}

function assertDateRange(checkIn: Date, checkOut: Date) {
  if (checkIn >= checkOut) {
    throw new BookingError("Дата заезда должна быть раньше даты выезда", "VALIDATION");
  }
}

async function assertCapacity(propertyId: string, guestsCount: number, options?: { requireActive?: boolean }) {
  const property = await getPropertyByIdOrSlug(propertyId);

  if (!property) {
    throw new BookingError("Объект не найден", "NOT_FOUND");
  }

  if (options?.requireActive && property.status !== "ACTIVE") {
    throw new BookingError("Нельзя создать бронирование на неактивный объект", "VALIDATION");
  }

  if (guestsCount > property.guests) {
    throw new BookingError(
      `Количество гостей превышает вместимость объекта (${property.guests})`,
      "CAPACITY",
    );
  }

  return property;
}

function assertStatusTransition(from: BookingStatus, to: BookingStatus) {
  if (!STATUS_TRANSITIONS[from].includes(to)) {
    throw new BookingError("Этот переход статуса бронирования не разрешён", "VALIDATION");
  }
}

async function assertNoOverlap(
  input: {
    propertyId: string;
    checkIn: Date;
    checkOut: Date;
    excludeId?: string;
    status: BookingStatus;
  },
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  if (!OCCUPYING_STATUSES.includes(input.status)) {
    return;
  }

  const overlapping = await db.booking.findFirst({
    where: {
      propertyId: input.propertyId,
      id: input.excludeId ? { not: input.excludeId } : undefined,
      status: { in: OCCUPYING_STATUSES },
      checkIn: { lt: input.checkOut },
      checkOut: { gt: input.checkIn },
    },
    include: {
      property: { select: { name: true } },
    },
  });

  if (overlapping) {
    throw new BookingError("Невозможно сохранить бронирование.", "CONFLICT", {
      propertyName: overlapping.property.name,
      checkIn: overlapping.checkIn.toISOString(),
      checkOut: overlapping.checkOut.toISOString(),
    });
  }
}

async function resolveChannelListing(
  propertyId: string,
  salesChannelId: string,
  channelListingId: string | null | undefined,
) {
  if (!channelListingId) {
    return null;
  }

  const listing = await prisma.channelListing.findUnique({
    where: { id: channelListingId },
  });

  if (!listing) {
    throw new BookingError("Объявление канала не найдено", "NOT_FOUND");
  }

  if (listing.propertyId !== propertyId) {
    throw new BookingError("Объявление не относится к выбранному объекту", "VALIDATION");
  }

  if (listing.salesChannelId !== salesChannelId) {
    throw new BookingError("Объявление не относится к выбранному каналу продаж", "VALIDATION");
  }

  return listing.id;
}

export async function getBookings(filters: BookingFilters = {}) {
  return prisma.booking.findMany({
    where: {
      propertyId: filters.propertyId,
      guestId: filters.guestId,
      salesChannelId: filters.salesChannelId,
      status: filters.status,
    },
    include: bookingInclude,
    orderBy: { checkIn: "desc" },
  });
}

export async function getBookingsOverlappingRange(input: {
  from: Date;
  to: Date;
  propertyId?: string;
  propertyIds?: string[];
  statuses?: BookingStatus[];
}) {
  return prisma.booking.findMany({
    where: {
      propertyId: input.propertyIds
        ? { in: input.propertyIds }
        : input.propertyId,
      status: input.statuses ? { in: input.statuses } : undefined,
      checkIn: { lt: input.to },
      checkOut: { gt: input.from },
    },
    include: bookingInclude,
    orderBy: { checkIn: "asc" },
  });
}

export async function getBookingsByUtcDateField(input: {
  field: "checkIn" | "checkOut";
  day: Date;
  statuses: BookingStatus[];
  propertyIds?: string[];
}) {
  const nextDay = new Date(input.day.getTime() + 86_400_000);

  return prisma.booking.findMany({
    where: {
      status: { in: input.statuses },
      propertyId: input.propertyIds ? { in: input.propertyIds } : undefined,
      [input.field]: { gte: input.day, lt: nextDay },
    },
    include: bookingInclude,
    orderBy: { checkIn: "asc" },
  });
}

export async function getBookingById(id: string) {
  return prisma.booking.findUnique({
    where: { id },
    include: bookingInclude,
  });
}

export async function getGuestBookings(guestId: string) {
  return getBookings({ guestId });
}

export async function createBooking(input: CreateBookingInput) {
  const guest = await getGuestById(input.guestId);

  if (!guest) {
    throw new BookingError("Гость не найден", "NOT_FOUND");
  }

  const salesChannel = await getSalesChannelById(input.salesChannelId);

  if (!salesChannel) {
    throw new BookingError("Канал продаж не найден", "NOT_FOUND");
  }

  const checkIn = toDate(input.checkIn, "checkIn");
  const checkOut = toDate(input.checkOut, "checkOut");
  assertDateRange(checkIn, checkOut);

  const property = await assertCapacity(input.propertyId, input.guestsCount, { requireActive: true });
  const status = input.status ?? "PENDING";
  const channelListingId = await resolveChannelListing(
    property.id,
    salesChannel.id,
    input.channelListingId,
  );

  const booking = await prisma.$transaction(async (tx) => {
    await assertNoOverlap(
      {
        propertyId: property.id,
        checkIn,
        checkOut,
        status,
      },
      tx,
    );

    return tx.booking.create({
      data: {
        propertyId: property.id,
        guestId: guest.id,
        salesChannelId: salesChannel.id,
        channelListingId,
        checkIn,
        checkOut,
        guestsCount: input.guestsCount,
        totalAmount: input.totalAmount,
        status,
        comment: input.comment ?? null,
      },
      include: bookingInclude,
    });
  });

  await createGuestHistory({
    guestId: guest.id,
    type: "BOOKING_CREATED",
    title: "Создано бронирование",
    description: `${property.name}, ${input.checkIn} — ${input.checkOut}`,
  });

  await notifyCrmBookingChanged(property.id);

  return booking;
}

export async function updateBooking(id: string, input: UpdateBookingInput) {
  const current = await getBookingById(id);

  if (!current) {
    throw new BookingError("Бронирование не найдено", "NOT_FOUND");
  }

  const nextPropertyId = input.propertyId ?? current.propertyId;
  const nextGuestId = input.guestId ?? current.guestId;
  const nextSalesChannelId = input.salesChannelId ?? current.salesChannelId;
  const nextChannelListingId =
    input.channelListingId === undefined ? current.channelListingId : input.channelListingId;
  const nextCheckIn = input.checkIn ? toDate(input.checkIn, "checkIn") : current.checkIn;
  const nextCheckOut = input.checkOut ? toDate(input.checkOut, "checkOut") : current.checkOut;
  const nextGuestsCount = input.guestsCount ?? current.guestsCount;
  const nextStatus = input.status ?? current.status;
  assertStatusTransition(current.status, nextStatus);

  assertDateRange(nextCheckIn, nextCheckOut);

  const guest = await getGuestById(nextGuestId);

  if (!guest) {
    throw new BookingError("Гость не найден", "NOT_FOUND");
  }

  const salesChannel = await getSalesChannelById(nextSalesChannelId);

  if (!salesChannel) {
    throw new BookingError("Канал продаж не найден", "NOT_FOUND");
  }

  const property = await assertCapacity(nextPropertyId, nextGuestsCount);
  const channelListingId = await resolveChannelListing(
    property.id,
    salesChannel.id,
    nextChannelListingId,
  );

  const booking = await prisma.$transaction(async (tx) => {
    await assertNoOverlap(
      {
        propertyId: property.id,
        checkIn: nextCheckIn,
        checkOut: nextCheckOut,
        excludeId: current.id,
        status: nextStatus,
      },
      tx,
    );

    return tx.booking.update({
      where: { id },
      data: {
        propertyId: property.id,
        guestId: guest.id,
        salesChannelId: salesChannel.id,
        channelListingId,
        checkIn: nextCheckIn,
        checkOut: nextCheckOut,
        guestsCount: nextGuestsCount,
        totalAmount: input.totalAmount ?? current.totalAmount,
        status: nextStatus,
        comment: input.comment === undefined ? current.comment : input.comment,
      },
      include: bookingInclude,
    });
  });

  const historyType = nextStatus === "CANCELLED" && current.status !== "CANCELLED"
    ? "BOOKING_CANCELLED"
    : "BOOKING_UPDATED";

  await createGuestHistory({
    guestId: guest.id,
    type: historyType,
    title: historyType === "BOOKING_CANCELLED" ? "Бронирование отменено" : "Бронирование изменено",
    description:
      historyType === "BOOKING_CANCELLED"
        ? `${property.name}, ${toDateInput(nextCheckIn)} — ${toDateInput(nextCheckOut)}`
        : describeBookingUpdate(current, {
            propertyName: property.name,
            checkIn: nextCheckIn,
            checkOut: nextCheckOut,
          }),
  });

  await notifyCrmBookingChanged(property.id);
  if (property.id !== current.propertyId) {
    await notifyCrmBookingChanged(current.propertyId);
  }

  return booking;
}

function describeBookingUpdate(
  current: BookingRecord,
  next: { propertyName: string; checkIn: Date; checkOut: Date },
) {
  const currentDates = `${formatDate(current.checkIn)} — ${formatDate(current.checkOut)}`;
  const nextDates = `${formatDate(next.checkIn)} — ${formatDate(next.checkOut)}`;
  const propertyChanged = current.property.name !== next.propertyName;
  const datesChanged = currentDates !== nextDates;

  const lines = ["Изменено бронирование:"];

  if (propertyChanged) {
    lines.push(`объект: ${current.property.name} → ${next.propertyName}`);
  } else {
    lines.push(`объект: ${next.propertyName}`);
  }

  if (datesChanged) {
    lines.push(`даты: ${currentDates} → ${nextDates}`);
  } else {
    lines.push(`даты: ${nextDates}`);
  }

  return lines.join("\n");
}

async function notifyCrmBookingChanged(propertyId: string) {
  const { notifyCrmBookingChanged: notify } = await import("@/lib/integrations/availability");
  await notify(propertyId);
}

function toDateInput(value: Date) {
  return toDateInputValue(value);
}

export async function deleteBooking(id: string) {
  const current = await getBookingById(id);

  if (!current) {
    throw new BookingError("Бронирование не найдено", "NOT_FOUND");
  }

  const imported = await prisma.externalBooking.findUnique({
    where: { bookingId: id },
  });

  if (imported) {
    throw new BookingError(
      "Нельзя удалить бронь, импортированную с канала продаж. Отмените её.",
      "CONFLICT",
    );
  }

  const paymentCount = await prisma.bookingPayment.count({ where: { bookingId: id } });
  if (paymentCount > 0) {
    throw new BookingError(
      "Нельзя удалить бронь с платежами. Отмените её; возврат — отдельная финансовая операция.",
      "CONFLICT",
    );
  }

  await prisma.booking.delete({
    where: { id },
  });

  await notifyCrmBookingChanged(current.propertyId);
}

export async function checkInBooking(id: string) {
  const current = await getBookingById(id);

  if (!current) {
    throw new BookingError("Бронирование не найдено", "NOT_FOUND");
  }

  if (current.status === "CANCELLED") {
    throw new BookingError("Нельзя заселить отменённое бронирование", "VALIDATION");
  }

  if (current.status === "COMPLETED") {
    throw new BookingError("Нельзя заселить завершённое бронирование", "VALIDATION");
  }

  if (current.status === "CONFIRMED") {
    return current;
  }

  const booking = await prisma.booking.update({
    where: { id },
    data: { status: "CONFIRMED" },
    include: bookingInclude,
  });

  await createGuestHistory({
    guestId: current.guestId,
    type: "CHECK_IN",
    title: "Заселение",
    description: current.property.name,
  });

  await notifyCrmBookingChanged(current.propertyId);

  return booking;
}

export async function checkOutBooking(id: string) {
  const current = await getBookingById(id);

  if (!current) {
    throw new BookingError("Бронирование не найдено", "NOT_FOUND");
  }

  if (current.status === "CANCELLED") {
    throw new BookingError("Нельзя выселить отменённое бронирование", "VALIDATION");
  }

  if (current.status === "COMPLETED") {
    return current;
  }

  if (current.status !== "PENDING" && current.status !== "CONFIRMED") {
    throw new BookingError("Выселить можно только активное бронирование", "VALIDATION");
  }

  const booking = await prisma.booking.update({
    where: { id },
    data: { status: "COMPLETED" },
    include: bookingInclude,
  });

  await createGuestHistory({
    guestId: current.guestId,
    type: "CHECK_OUT",
    title: "Выселение",
    description: current.property.name,
  });

  await notifyCrmBookingChanged(current.propertyId);

  return booking;
}

export function bookingErrorStatus(error: BookingError) {
  if (error.code === "CONFLICT") {
    return 409;
  }

  if (error.code === "NOT_FOUND") {
    return 404;
  }

  return 400;
}

export function bookingErrorPayload(error: BookingError) {
  if (error.code === "CONFLICT") {
    const propertyName = error.meta?.propertyName ?? "объект";
    const range =
      error.meta?.checkIn && error.meta.checkOut
        ? `${formatDate(error.meta.checkIn)} — ${formatDate(error.meta.checkOut)}`
        : null;

    return {
      error: "Невозможно сохранить бронирование.",
      code: "CONFLICT" as const,
      details: [
        `Объект «${propertyName}» уже занят${range ? ":" : "."}`,
        ...(range ? [range] : []),
        "Выберите другие даты или другой объект.",
      ],
    };
  }

  const code =
    error.code === "NOT_FOUND" ? ("NOT_FOUND" as const) : ("VALIDATION_ERROR" as const);
  return { error: error.message, code };
}
