import type { BookingStatus } from "@prisma/client";
import {
  formatDate,
  formatNights,
  nightsBetween,
  occupiesUtcDay,
  startOfUtcDay,
} from "@/lib/format";
import { bookingStatusLabels } from "@/lib/guest-labels";

export type BookingPaymentUiState =
  | "UNPAID"
  | "PARTIAL"
  | "PAID"
  | "HAS_REFUND"
  | "REFUNDED"
  | "OVERPAID";

export type BookingPaymentSummary = {
  paidAmount: number;
  refundedAmount: number;
  netPaidAmount: number;
  remainingAmount: number;
  overpaymentAmount: number;
};

export type BookingListKpi = {
  total: number;
  staying: number;
  upcoming: number;
  checkInToday: number;
  checkOutToday: number;
  cancelled: number;
};

export type BookingPeriodPreset = "TODAY" | "WEEK" | "MONTH" | "ALL";

export type BookingSort =
  | "NEAREST"
  | "NEWEST"
  | "CHECK_IN"
  | "CHECK_OUT"
  | "AMOUNT";

export const bookingStatusBadgeClass: Record<BookingStatus, string> = {
  PENDING: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200/80",
  CONFIRMED: "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200/80",
  COMPLETED: "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200/80",
  CANCELLED: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/80",
};

export const bookingPaymentUiLabels: Record<BookingPaymentUiState, string> = {
  UNPAID: "Не оплачено",
  PARTIAL: "Частично",
  PAID: "Оплачено",
  HAS_REFUND: "Есть возврат",
  REFUNDED: "Возвращено",
  OVERPAID: "Переплата",
};

export const bookingPaymentBadgeClass: Record<BookingPaymentUiState, string> = {
  UNPAID: "bg-slate-100 text-slate-600",
  PARTIAL: "bg-amber-50 text-amber-800",
  PAID: "bg-emerald-50 text-emerald-800",
  HAS_REFUND: "bg-violet-50 text-violet-800",
  REFUNDED: "bg-slate-100 text-slate-600",
  OVERPAID: "bg-sky-50 text-sky-800",
};

export function buildPaymentSummary(
  totalAmount: number,
  paidAmount: number,
  refundedAmount: number,
): BookingPaymentSummary {
  const netPaidAmount = paidAmount - refundedAmount;
  const remainingRaw = totalAmount - netPaidAmount;
  return {
    paidAmount,
    refundedAmount,
    netPaidAmount,
    remainingAmount: Math.max(0, remainingRaw),
    overpaymentAmount: Math.max(0, -remainingRaw),
  };
}

/** UI labels only — derived from Stage 12.2 finance amounts. */
export function bookingPaymentUiState(
  totalAmount: number,
  summary: Pick<BookingPaymentSummary, "paidAmount" | "refundedAmount" | "netPaidAmount">,
): BookingPaymentUiState {
  const { paidAmount, refundedAmount, netPaidAmount } = summary;
  if (paidAmount <= 0) return "UNPAID";
  if (refundedAmount > 0 && netPaidAmount <= 0) return "REFUNDED";
  if (refundedAmount > 0 && netPaidAmount < totalAmount) return "HAS_REFUND";
  if (netPaidAmount > totalAmount) return "OVERPAID";
  if (netPaidAmount >= totalAmount) return "PAID";
  if (netPaidAmount > 0) return "PARTIAL";
  return "UNPAID";
}

export function todayUtcIsoDate(now = new Date()) {
  return startOfUtcDay(now).toISOString().slice(0, 10);
}

export function bookingTodayFlags(
  checkIn: string,
  checkOut: string,
  status: BookingStatus,
  now = new Date(),
) {
  const today = startOfUtcDay(now);
  const checkInDay = startOfUtcDay(checkIn);
  const checkOutDay = startOfUtcDay(checkOut);
  const active = status === "PENDING" || status === "CONFIRMED";
  const completedOrActive =
    status === "PENDING" || status === "CONFIRMED" || status === "COMPLETED";

  return {
    checkInToday: completedOrActive && checkInDay.getTime() === today.getTime(),
    checkOutToday: completedOrActive && checkOutDay.getTime() === today.getTime(),
    staying:
      active && occupiesUtcDay(checkIn, checkOut, today) && checkOutDay.getTime() !== today.getTime(),
  };
}

export function buildBookingListKpi(
  bookings: Array<{
    checkIn: string;
    checkOut: string;
    status: BookingStatus;
  }>,
  now = new Date(),
): BookingListKpi {
  const today = startOfUtcDay(now);
  let staying = 0;
  let upcoming = 0;
  let checkInToday = 0;
  let checkOutToday = 0;
  let cancelled = 0;

  for (const booking of bookings) {
    const flags = bookingTodayFlags(
      booking.checkIn,
      booking.checkOut,
      booking.status,
      now,
    );
    if (booking.status === "CANCELLED") cancelled += 1;
    if (flags.staying) staying += 1;
    if (flags.checkInToday) checkInToday += 1;
    if (flags.checkOutToday) checkOutToday += 1;
    if (
      (booking.status === "PENDING" || booking.status === "CONFIRMED") &&
      startOfUtcDay(booking.checkIn).getTime() > today.getTime()
    ) {
      upcoming += 1;
    }
  }

  return {
    total: bookings.length,
    staying,
    upcoming,
    checkInToday,
    checkOutToday,
    cancelled,
  };
}

export function periodRange(
  preset: BookingPeriodPreset,
  now = new Date(),
): { from: Date | null; to: Date | null } {
  if (preset === "ALL") return { from: null, to: null };
  const today = startOfUtcDay(now);
  if (preset === "TODAY") {
    const to = new Date(today);
    to.setUTCDate(to.getUTCDate() + 1);
    return { from: today, to };
  }
  if (preset === "WEEK") {
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - 7);
    const to = new Date(today);
    to.setUTCDate(to.getUTCDate() + 14);
    return { from, to };
  }
  const from = new Date(today);
  from.setUTCDate(1);
  const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 2, 1));
  return { from, to };
}

export function bookingOverlapsPeriod(
  checkIn: string,
  checkOut: string,
  from: Date | null,
  to: Date | null,
) {
  if (!from && !to) return true;
  const start = startOfUtcDay(checkIn).getTime();
  const end = startOfUtcDay(checkOut).getTime();
  const fromMs = from ? from.getTime() : Number.NEGATIVE_INFINITY;
  const toMs = to ? to.getTime() : Number.POSITIVE_INFINITY;
  return start < toMs && end > fromMs;
}

export function formatStayRangeShort(checkIn: string, checkOut: string) {
  return `${formatDate(checkIn)} — ${formatDate(checkOut)}`;
}

export function formatStayNightsLabel(checkIn: string, checkOut: string) {
  const n = nightsBetween(checkIn, checkOut);
  return { nights: n, label: formatNights(n) };
}

export { bookingStatusLabels, nightsBetween, formatNights };
