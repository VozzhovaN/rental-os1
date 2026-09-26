import type { BookingStatus, PropertyType } from "@prisma/client";
import {
  getBookingsByUtcDateField,
  getBookingsOverlappingRange,
  serializeBooking,
  type BookingDTO,
} from "@/lib/bookings";
import { addUtcDays, parseDateOnly, startOfNextUtcMonth, startOfUtcDay, startOfUtcMonth } from "@/lib/format";
import { getDayPriceData, type DayPriceData } from "@/lib/pricing/day-prices";
import { prisma } from "@/lib/prisma";
import { serializeProperty, type PropertyDTO } from "@/lib/properties";
import { PROPERTY_TYPES } from "@/lib/validations/property";

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
];

export const INCOME_BOOKING_STATUSES: BookingStatus[] = ["CONFIRMED", "COMPLETED"];

export const MOVEMENT_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED"];

export function isIncomeBookingStatus(status: BookingStatus) {
  return status === "CONFIRMED" || status === "COMPLETED";
}

export function sumDashboardIncome(
  bookings: Array<{ status: BookingStatus; totalAmount: number }>,
) {
  return bookings
    .filter((booking) => isIncomeBookingStatus(booking.status))
    .reduce((sum, booking) => sum + booking.totalAmount, 0);
}

export type DashboardFilters = {
  year: number;
  month: number;
  date: string;
  propertyId?: string;
  propertyType?: PropertyType;
  bookingStatus?: Exclude<BookingStatus, "CANCELLED">;
  q?: string;
};

export type DashboardStats = {
  properties: number;
  checkIns: number;
  checkOuts: number;
  income: number;
  bookings: number;
};

export type DashboardData = {
  stats: DashboardStats;
  period: {
    year: number;
    month: number;
    date: string;
    from: string;
    to: string;
  };
  properties: PropertyDTO[];
  bookings: BookingDTO[];
  checkIns: BookingDTO[];
  checkOuts: BookingDTO[];
  /** Nightly price overrides + base prices for the visible month. */
  dayPrices: DayPriceData;
};

function isPropertyType(value: string): value is PropertyType {
  return (PROPERTY_TYPES as readonly string[]).includes(value);
}

function isCalendarBookingStatus(
  value: string,
): value is Exclude<BookingStatus, "CANCELLED"> {
  return value === "PENDING" || value === "CONFIRMED" || value === "COMPLETED";
}

export function searchParamsFromRecord(
  record: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string" && value.length > 0) {
      params.set(key, value);
    }
  }

  return params;
}

export function parseDashboardFilters(searchParams: URLSearchParams): DashboardFilters {
  const now = new Date();
  const defaultYear = now.getUTCFullYear();
  const defaultMonth = now.getUTCMonth() + 1;
  const yearRaw = Number(searchParams.get("year") ?? defaultYear);
  const monthRaw = Number(searchParams.get("month") ?? defaultMonth);
  const year = Number.isInteger(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100 ? yearRaw : defaultYear;
  const month = Number.isInteger(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : defaultMonth;
  const date =
    parseDateOnly(searchParams.get("date") ?? "")?.toISOString().slice(0, 10) ??
    startOfUtcDay(now).toISOString().slice(0, 10);
  const propertyType = searchParams.get("propertyType") ?? "";
  const bookingStatus = searchParams.get("bookingStatus") ?? "";

  return {
    year,
    month,
    date,
    propertyId: searchParams.get("propertyId") || undefined,
    propertyType: isPropertyType(propertyType) ? propertyType : undefined,
    bookingStatus: isCalendarBookingStatus(bookingStatus) ? bookingStatus : undefined,
    q: searchParams.get("q")?.trim() || undefined,
  };
}

export function dashboardHref(filters: Partial<DashboardFilters> & Pick<DashboardFilters, "year" | "month" | "date">) {
  const params = new URLSearchParams();
  params.set("year", String(filters.year));
  params.set("month", String(filters.month));
  params.set("date", filters.date);

  if (filters.propertyId) {
    params.set("propertyId", filters.propertyId);
  }

  if (filters.propertyType) {
    params.set("propertyType", filters.propertyType);
  }

  if (filters.bookingStatus) {
    params.set("bookingStatus", filters.bookingStatus);
  }

  if (filters.q) {
    params.set("q", filters.q);
  }

  return `/crm/dashboard?${params.toString()}`;
}

export function shiftDashboardMonth(year: number, month: number, delta: number) {
  const next = new Date(Date.UTC(year, month - 1 + delta, 1));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
  };
}

export type BookingChannelStat = {
  channelId: string;
  channelCode: string;
  channelName: string;
  bookingCount: number;
  bookingShare: number;
  turnover: number;
};

export type DashboardChannelStats = {
  year: number;
  month: number;
  /** ACTIVE_BOOKING_STATUSES: PENDING | CONFIRMED | COMPLETED (CANCELLED excluded). */
  statusesIncluded: BookingStatus[];
  totalBookings: number;
  /** Sum of Booking.totalAmount — booking turnover, not business revenue. */
  totalTurnover: number;
  channels: BookingChannelStat[];
};

/**
 * Booking channel mix for the dashboard month.
 * Status rule matches dashboard calendar bookings: ACTIVE_BOOKING_STATUSES
 * (PENDING included, CANCELLED excluded). Turnover ≠ finance revenue.
 */
export async function getDashboardChannelStats(input: {
  year: number;
  month: number;
}): Promise<DashboardChannelStats> {
  const monthStart = startOfUtcMonth(input.year, input.month);
  const monthEnd = startOfNextUtcMonth(input.year, input.month);
  const statuses = ACTIVE_BOOKING_STATUSES;

  const grouped = await prisma.booking.groupBy({
    by: ["salesChannelId"],
    where: {
      status: { in: statuses },
      checkIn: { lt: monthEnd },
      checkOut: { gt: monthStart },
    },
    _count: { _all: true },
    _sum: { totalAmount: true },
  });

  const totalBookings = grouped.reduce((sum, row) => sum + row._count._all, 0);
  const totalTurnover = grouped.reduce(
    (sum, row) => sum + (row._sum.totalAmount ?? 0),
    0,
  );

  if (grouped.length === 0) {
    return {
      year: input.year,
      month: input.month,
      statusesIncluded: statuses,
      totalBookings: 0,
      totalTurnover: 0,
      channels: [],
    };
  }

  const channelIds = grouped.map((row) => row.salesChannelId);
  const channels = await prisma.salesChannel.findMany({
    where: { id: { in: channelIds } },
    select: { id: true, code: true, name: true },
  });
  const channelById = new Map(channels.map((channel) => [channel.id, channel]));

  const stats: BookingChannelStat[] = grouped
    .map((row) => {
      const channel = channelById.get(row.salesChannelId);
      const bookingCount = row._count._all;
      const turnover = row._sum.totalAmount ?? 0;
      return {
        channelId: row.salesChannelId,
        channelCode: channel?.code ?? "UNKNOWN",
        channelName: channel?.name ?? "Неизвестный канал",
        bookingCount,
        bookingShare:
          totalBookings > 0
            ? Math.round((bookingCount / totalBookings) * 100)
            : 0,
        turnover,
      };
    })
    .sort((a, b) => {
      if (b.bookingCount !== a.bookingCount) {
        return b.bookingCount - a.bookingCount;
      }
      return b.turnover - a.turnover;
    })
    .slice(0, 5);

  return {
    year: input.year,
    month: input.month,
    statusesIncluded: statuses,
    totalBookings,
    totalTurnover,
    channels: stats,
  };
}

export async function getDashboardData(filters: DashboardFilters): Promise<DashboardData> {
  const monthStart = startOfUtcMonth(filters.year, filters.month);
  const monthEnd = startOfNextUtcMonth(filters.year, filters.month);
  const selectedDay = parseDateOnly(filters.date) ?? startOfUtcDay(new Date());
  const calendarStatuses = filters.bookingStatus
    ? [filters.bookingStatus]
    : ACTIVE_BOOKING_STATUSES;

  const [properties, activePropertyCount] = await Promise.all([
    prisma.property.findMany({
      where: {
        id: filters.propertyId,
        type: filters.propertyType,
        name: filters.q ? { contains: filters.q } : undefined,
      },
      orderBy: { name: "asc" },
    }),
    prisma.property.count({
      where: { status: "ACTIVE" },
    }),
  ]);

  const propertyIds = properties.map((property) => property.id);

  const [calendarBookings, checkInRecords, checkOutRecords] = propertyIds.length
    ? await Promise.all([
        getBookingsOverlappingRange({
          from: monthStart,
          to: monthEnd,
          propertyIds,
          statuses: calendarStatuses,
        }),
        getBookingsByUtcDateField({
          field: "checkIn",
          day: selectedDay,
          statuses: MOVEMENT_STATUSES,
          propertyIds,
        }),
        getBookingsByUtcDateField({
          field: "checkOut",
          day: selectedDay,
          statuses: MOVEMENT_STATUSES,
          propertyIds,
        }),
      ])
    : [[], [], []];

  const serializedBookings = calendarBookings.map(serializeBooking);
  const checkIns = checkInRecords.map(serializeBooking);
  const checkOuts = checkOutRecords.map(serializeBooking);

  const dayPrices = await getDayPriceData({
    propertyIds,
    dateFrom: monthStart.toISOString().slice(0, 10),
    dateTo: addUtcDays(monthEnd, -1).toISOString().slice(0, 10),
  });

  return {
    stats: {
      properties: activePropertyCount,
      checkIns: checkIns.length,
      checkOuts: checkOuts.length,
      income: sumDashboardIncome(serializedBookings),
      bookings: serializedBookings.length,
    },
    period: {
      year: filters.year,
      month: filters.month,
      date: selectedDay.toISOString().slice(0, 10),
      from: monthStart.toISOString(),
      to: monthEnd.toISOString(),
    },
    properties: properties.map(serializeProperty),
    bookings: serializedBookings,
    checkIns,
    checkOuts,
    dayPrices,
  };
}
