import type { BookingStatus } from "@prisma/client";
import { startOfUtcDay } from "@/lib/format";

export type GuestUiStatus =
  | "STAYING"
  | "UPCOMING"
  | "PAST"
  | "NONE";

export const guestUiStatusLabels: Record<GuestUiStatus, string> = {
  STAYING: "Сейчас проживает",
  UPCOMING: "Будущая бронь",
  PAST: "Прошлый гость",
  NONE: "Без бронирований",
};

export const guestUiStatusClass: Record<GuestUiStatus, string> = {
  STAYING: "bg-[var(--finance-green-light)] text-[var(--finance-green)]",
  UPCOMING: "bg-[var(--finance-blue-light)] text-[var(--finance-blue)]",
  PAST: "bg-[#F1F5F9] text-[#475569]",
  NONE: "bg-[#F8FAFC] text-[#94A3B8]",
};

type BookingLike = {
  id: string;
  checkIn: Date | string;
  checkOut: Date | string;
  status: BookingStatus | string;
  propertyName?: string;
  property?: { name: string };
};

function toDate(value: Date | string) {
  return typeof value === "string" ? new Date(value) : value;
}

function isOpenStatus(status: string) {
  return status === "PENDING" || status === "CONFIRMED";
}

/** Active stay: open status, check-in today or earlier, check-out still ahead. */
export function isActiveStay(booking: BookingLike, today = startOfUtcDay(new Date())) {
  if (!isOpenStatus(String(booking.status))) return false;
  const checkIn = startOfUtcDay(toDate(booking.checkIn));
  const checkOut = startOfUtcDay(toDate(booking.checkOut));
  return checkIn.getTime() <= today.getTime() && checkOut.getTime() > today.getTime();
}

/** Future booking: open status, check-in after today. */
export function isFutureBooking(booking: BookingLike, today = startOfUtcDay(new Date())) {
  if (!isOpenStatus(String(booking.status))) return false;
  return startOfUtcDay(toDate(booking.checkIn)).getTime() > today.getTime();
}

export function deriveGuestUiStatus(
  bookings: BookingLike[],
  today = startOfUtcDay(new Date()),
): GuestUiStatus {
  if (bookings.some((b) => isActiveStay(b, today))) return "STAYING";
  if (bookings.some((b) => isFutureBooking(b, today))) return "UPCOMING";
  const hasPast = bookings.some((b) => {
    if (b.status === "CANCELLED") return false;
    if (b.status === "COMPLETED") return true;
    return startOfUtcDay(toDate(b.checkOut)).getTime() <= today.getTime();
  });
  return hasPast ? "PAST" : "NONE";
}

export function pickLastStay<T extends BookingLike>(
  bookings: T[],
  today = startOfUtcDay(new Date()),
): T | null {
  const past = bookings
    .filter((b) => {
      if (b.status === "CANCELLED") return false;
      return startOfUtcDay(toDate(b.checkOut)).getTime() <= today.getTime();
    })
    .sort(
      (a, b) =>
        toDate(b.checkOut).getTime() - toDate(a.checkOut).getTime(),
    );
  return past[0] ?? null;
}

export function pickNextBooking<T extends BookingLike>(
  bookings: T[],
  today = startOfUtcDay(new Date()),
): T | null {
  const candidates = bookings
    .filter(
      (b) =>
        isActiveStay(b, today) || isFutureBooking(b, today),
    )
    .sort(
      (a, b) =>
        toDate(a.checkIn).getTime() - toDate(b.checkIn).getTime(),
    );
  return candidates[0] ?? null;
}

export function guestInitials(guest: {
  firstName: string;
  lastName: string | null;
}) {
  const a = guest.lastName?.trim()?.[0] ?? "";
  const b = guest.firstName?.trim()?.[0] ?? "";
  const letters = `${a}${b}`.toUpperCase() || guest.firstName.slice(0, 2).toUpperCase();
  return letters.slice(0, 2);
}

/** Stable neutral avatar hue from id/name. */
export function guestAvatarTone(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const tones = [
    "bg-[#E8EEF6] text-[#3B4F6E]",
    "bg-[#EAF2F0] text-[#2F5B52]",
    "bg-[#EEEAF5] text-[#4A3F6B]",
    "bg-[#F0EEE8] text-[#5A5346]",
    "bg-[#E9F0F5] text-[#35586B]",
  ];
  return tones[hash % tones.length]!;
}

export function telegramHref(contact: string | null | undefined) {
  if (!contact) return null;
  const trimmed = contact.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const handle = trimmed.replace(/^@/, "");
  if (/^[a-zA-Z0-9_]{4,}$/.test(handle)) {
    return `https://t.me/${handle}`;
  }
  return null;
}
