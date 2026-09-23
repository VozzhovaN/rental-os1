import type { BookingDTO } from "@/lib/bookings";
import { occupiesUtcDay, startOfUtcDay } from "@/lib/format";

export type CalendarBookingSpan = {
  booking: BookingDTO;
  startIndex: number;
  dayCount: number;
  lane: number;
};

export function getOccupiedSpan(
  checkIn: string,
  checkOut: string,
  days: Date[],
): { startIndex: number; dayCount: number } | null {
  let startIndex = -1;
  let dayCount = 0;

  days.forEach((day, index) => {
    if (!occupiesUtcDay(checkIn, checkOut, day)) {
      return;
    }

    if (startIndex === -1) {
      startIndex = index;
    }

    dayCount += 1;
  });

  if (startIndex < 0 || dayCount === 0) {
    return null;
  }

  return { startIndex, dayCount };
}

export function layoutPropertyBookings(bookings: BookingDTO[], days: Date[]): CalendarBookingSpan[] {
  const spans = bookings
    .flatMap((booking) => {
      const span = getOccupiedSpan(booking.checkIn, booking.checkOut, days);
      return span ? [{ booking, ...span }] : [];
    })
    .sort((left, right) => left.startIndex - right.startIndex || right.dayCount - left.dayCount);

  const laneEnds: number[] = [];

  return spans.map((span) => {
    let lane = 0;

    while (laneEnds[lane] !== undefined && laneEnds[lane] > span.startIndex) {
      lane += 1;
    }

    laneEnds[lane] = span.startIndex + span.dayCount;
    return { ...span, lane };
  });
}

export function isSameUtcDay(left: Date | string, right: Date | string) {
  return startOfUtcDay(left).getTime() === startOfUtcDay(right).getTime();
}

export function bookingBarClass(status: BookingDTO["status"]) {
  if (status === "PENDING") {
    return "booking-bar booking-bar-pending";
  }

  if (status === "COMPLETED") {
    return "booking-bar booking-bar-completed";
  }

  return "booking-bar booking-bar-confirmed";
}
