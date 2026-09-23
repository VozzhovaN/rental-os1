import { type Guest, type MessengerType } from "@prisma/client";
import { prismaGuestSearchWhere } from "@/lib/guest-search";
import { prisma } from "@/lib/prisma";
import type { CreateGuestInput, UpdateGuestInput } from "@/lib/validations/guest";

export class GuestError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "CONFLICT",
  ) {
    super(message);
    this.name = "GuestError";
  }
}

export type GuestDTO = Omit<Guest, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type GuestListItemDTO = GuestDTO & {
  bookingsCount: number;
  lastBooking: {
    id: string;
    checkIn: string;
    checkOut: string;
    propertyName: string;
    status: string;
  } | null;
};

export function serializeGuest(guest: Guest): GuestDTO {
  return {
    ...guest,
    createdAt: guest.createdAt.toISOString(),
    updatedAt: guest.updatedAt.toISOString(),
  };
}

export async function getGuests(filters: { q?: string } = {}) {
  return prisma.guest.findMany({
    where: prismaGuestSearchWhere(filters.q ?? ""),
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { bookings: true } },
      bookings: {
        orderBy: { checkIn: "desc" },
        take: 1,
        include: { property: { select: { name: true } } },
      },
    },
  });
}

export function serializeGuestListItem(
  guest: Awaited<ReturnType<typeof getGuests>>[number],
): GuestListItemDTO {
  const last = guest.bookings[0] ?? null;

  return {
    ...serializeGuest(guest),
    bookingsCount: guest._count.bookings,
    lastBooking: last
      ? {
          id: last.id,
          checkIn: last.checkIn.toISOString(),
          checkOut: last.checkOut.toISOString(),
          propertyName: last.property.name,
          status: last.status,
        }
      : null,
  };
}

export function normalizePhoneDigits(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");

  if (digits.length >= 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    return digits.slice(-10);
  }

  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export async function getGuestById(id: string) {
  return prisma.guest.findUnique({
    where: { id },
  });
}

export async function findGuestByEmail(email: string) {
  const normalized = email.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  const guests = await prisma.guest.findMany({
    where: { email: { not: null } },
  });

  return guests.find((guest) => guest.email?.trim().toLowerCase() === normalized) ?? null;
}

export async function findGuestByPhone(phone: string) {
  const needle = normalizePhoneDigits(phone);

  if (!needle) {
    return null;
  }

  const guests = await prisma.guest.findMany({
    where: { phone: { not: null } },
  });

  return guests.find((guest) => normalizePhoneDigits(guest.phone) === needle) ?? null;
}

export async function createGuest(input: CreateGuestInput) {
  return prisma.guest.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName ?? null,
      middleName: input.middleName ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      messengerType: (input.messengerType ?? null) as MessengerType | null,
      messengerContact: input.messengerContact ?? null,
      comment: input.comment ?? null,
    },
  });
}

export async function updateGuest(id: string, input: UpdateGuestInput) {
  const current = await getGuestById(id);

  if (!current) {
    throw new GuestError("Гость не найден", "NOT_FOUND");
  }

  return prisma.guest.update({
    where: { id },
    data: {
      ...input,
      messengerType: input.messengerType === undefined ? undefined : input.messengerType,
    },
  });
}

export async function deleteGuest(id: string) {
  const current = await getGuestById(id);

  if (!current) {
    throw new GuestError("Гость не найден", "NOT_FOUND");
  }

  const bookingsCount = await prisma.booking.count({
    where: { guestId: id },
  });

  if (bookingsCount > 0) {
    throw new GuestError("Нельзя удалить гостя с бронированиями", "CONFLICT");
  }

  await prisma.guest.delete({
    where: { id },
  });
}
