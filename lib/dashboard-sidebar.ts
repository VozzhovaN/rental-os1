import type { BookingStatus } from "@prisma/client";
import { formatGuestName, parseDateOnly, startOfNextUtcMonth, startOfUtcDay, startOfUtcMonth } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/**
 * SALES_EVENT_DATE_GAP
 * BuyerInterest / SaleListing do not store purchasedAt.
 * Purchase events use BuyerHistory(type=PURCHASE_COMPLETED).createdAt only.
 * Interests marked PURCHASED without that history entry are omitted from counts/calendars.
 */

export const TODAY_EVENT_BOOKING_STATUSES: BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
];

export type TodayEventKind = "CHECK_IN" | "CHECK_OUT" | "VIEWING" | "SALE";

export type TodayEventItem = {
  id: string;
  kind: TodayEventKind;
  label: string;
  time: string | null;
  sortAt: string | null;
  propertyName: string;
  personName: string | null;
  href: string;
};

export type DashboardTodayEvents = {
  date: string;
  counts: {
    checkIns: number;
    checkOuts: number;
    viewings: number;
    purchases: number;
  };
  events: TodayEventItem[];
  /** Documented gap: purchases without PURCHASE_COMPLETED history are not counted. */
  knownGaps: ["SALES_EVENT_DATE_GAP"];
};

export type SalesCalendarEventKind = "VIEWING" | "DEPOSIT" | "PURCHASE";

export type SalesCalendarEvent = {
  id: string;
  kind: SalesCalendarEventKind;
  label: string;
  time: string | null;
  sortAt: string | null;
  day: string;
  propertyName: string;
  personName: string | null;
  href: string;
  amount: number | null;
  status: string | null;
};

export type SalesCalendarDaySummary = {
  date: string;
  kinds: SalesCalendarEventKind[];
  extra: number;
};

export type SalesCalendarData = {
  year: number;
  month: number;
  from: string;
  to: string;
  events: SalesCalendarEvent[];
  days: SalesCalendarDaySummary[];
  knownGaps: ["SALES_EVENT_DATE_GAP"];
};

function addUtcDays(day: Date, days: number) {
  return new Date(day.getTime() + days * 86_400_000);
}

/** HH:mm in UTC, or null when the timestamp is date-only midnight. */
export function formatUtcTimeOrNull(value: Date | string): string | null {
  const date = typeof value === "string" ? new Date(value) : value;
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();
  if (hours === 0 && minutes === 0 && seconds === 0) {
    return null;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function compareTodayEvents(a: TodayEventItem, b: TodayEventItem) {
  if (a.sortAt && b.sortAt) {
    return a.sortAt.localeCompare(b.sortAt);
  }
  if (a.sortAt && !b.sortAt) return -1;
  if (!a.sortAt && b.sortAt) return 1;
  return a.label.localeCompare(b.label, "ru");
}

function compareSalesEvents(a: SalesCalendarEvent, b: SalesCalendarEvent) {
  if (a.sortAt && b.sortAt) {
    return a.sortAt.localeCompare(b.sortAt);
  }
  if (a.sortAt && !b.sortAt) return -1;
  if (!a.sortAt && b.sortAt) return 1;
  return a.label.localeCompare(b.label, "ru");
}

function summarizeDays(events: SalesCalendarEvent[]): SalesCalendarDaySummary[] {
  const byDay = new Map<string, SalesCalendarEventKind[]>();

  for (const event of events) {
    const list = byDay.get(event.day) ?? [];
    list.push(event.kind);
    byDay.set(event.day, list);
  }

  return [...byDay.entries()].map(([date, kinds]) => ({
    date,
    kinds: kinds.slice(0, 3),
    extra: Math.max(0, kinds.length - 3),
  }));
}

export async function getDashboardTodayEvents(dayInput?: Date): Promise<DashboardTodayEvents> {
  const day = startOfUtcDay(dayInput ?? new Date());
  const nextDay = addUtcDays(day, 1);
  const date = day.toISOString().slice(0, 10);

  const [checkIns, checkOuts, viewings, purchases] = await Promise.all([
    prisma.booking.findMany({
      where: {
        status: { in: TODAY_EVENT_BOOKING_STATUSES },
        checkIn: { gte: day, lt: nextDay },
      },
      include: {
        property: { select: { name: true } },
        guest: { select: { firstName: true, lastName: true, middleName: true } },
      },
      orderBy: { checkIn: "asc" },
    }),
    prisma.booking.findMany({
      where: {
        status: { in: TODAY_EVENT_BOOKING_STATUSES },
        checkOut: { gte: day, lt: nextDay },
      },
      include: {
        property: { select: { name: true } },
        guest: { select: { firstName: true, lastName: true, middleName: true } },
      },
      orderBy: { checkOut: "asc" },
    }),
    prisma.viewing.findMany({
      where: {
        status: { not: "CANCELLED" },
        scheduledAt: { gte: day, lt: nextDay },
      },
      include: {
        buyerInterest: {
          include: {
            buyer: { select: { id: true, name: true } },
            saleListing: {
              select: {
                id: true,
                property: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.buyerHistory.findMany({
      where: {
        type: "PURCHASE_COMPLETED",
        createdAt: { gte: day, lt: nextDay },
      },
      include: {
        buyer: { select: { id: true, name: true } },
        buyerInterest: {
          include: {
            saleListing: {
              select: {
                id: true,
                property: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const events: TodayEventItem[] = [];

  for (const booking of checkIns) {
    const time = formatUtcTimeOrNull(booking.checkIn);
    events.push({
      id: `check-in-${booking.id}`,
      kind: "CHECK_IN",
      label: "Заезд",
      time,
      sortAt: time ? booking.checkIn.toISOString() : null,
      propertyName: booking.property.name,
      personName: formatGuestName(booking.guest),
      href: `/crm/bookings/${booking.id}`,
    });
  }

  for (const booking of checkOuts) {
    const time = formatUtcTimeOrNull(booking.checkOut);
    events.push({
      id: `check-out-${booking.id}`,
      kind: "CHECK_OUT",
      label: "Выезд",
      time,
      sortAt: time ? booking.checkOut.toISOString() : null,
      propertyName: booking.property.name,
      personName: formatGuestName(booking.guest),
      href: `/crm/bookings/${booking.id}`,
    });
  }

  for (const viewing of viewings) {
    const time = formatUtcTimeOrNull(viewing.scheduledAt);
    events.push({
      id: `viewing-${viewing.id}`,
      kind: "VIEWING",
      label: "Показ",
      time,
      sortAt: viewing.scheduledAt.toISOString(),
      propertyName: viewing.buyerInterest.saleListing.property.name,
      personName: viewing.buyerInterest.buyer.name,
      href: `/crm/sales/clients/${viewing.buyerInterest.buyer.id}`,
    });
  }

  for (const purchase of purchases) {
    const listing = purchase.buyerInterest?.saleListing;
    const time = formatUtcTimeOrNull(purchase.createdAt);
    events.push({
      id: `sale-${purchase.id}`,
      kind: "SALE",
      label: "Сделка",
      time,
      sortAt: purchase.createdAt.toISOString(),
      propertyName: listing?.property.name ?? "Объект продажи",
      personName: purchase.buyer.name,
      href: listing
        ? `/crm/sales/properties/${listing.id}`
        : `/crm/sales/clients/${purchase.buyer.id}`,
    });
  }

  events.sort(compareTodayEvents);

  return {
    date,
    counts: {
      checkIns: checkIns.length,
      checkOuts: checkOuts.length,
      viewings: viewings.length,
      purchases: purchases.length,
    },
    events: events.slice(0, 5),
    knownGaps: ["SALES_EVENT_DATE_GAP"],
  };
}

export async function getSalesCalendarEvents(input: {
  year: number;
  month: number;
}): Promise<SalesCalendarData> {
  const monthStart = startOfUtcMonth(input.year, input.month);
  const monthEnd = startOfNextUtcMonth(input.year, input.month);

  const [viewings, deposits, purchases] = await Promise.all([
    prisma.viewing.findMany({
      where: {
        status: { not: "CANCELLED" },
        scheduledAt: { gte: monthStart, lt: monthEnd },
      },
      include: {
        buyerInterest: {
          include: {
            buyer: { select: { id: true, name: true } },
            saleListing: {
              select: {
                id: true,
                property: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.deposit.findMany({
      where: {
        OR: [
          {
            status: "PAID",
            paidAt: { gte: monthStart, lt: monthEnd },
          },
          {
            status: "PENDING",
            createdAt: { gte: monthStart, lt: monthEnd },
          },
        ],
      },
      include: {
        buyerInterest: {
          include: {
            buyer: { select: { id: true, name: true } },
            saleListing: {
              select: {
                id: true,
                property: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.buyerHistory.findMany({
      where: {
        type: "PURCHASE_COMPLETED",
        createdAt: { gte: monthStart, lt: monthEnd },
      },
      include: {
        buyer: { select: { id: true, name: true } },
        buyerInterest: {
          include: {
            saleListing: {
              select: {
                id: true,
                property: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const events: SalesCalendarEvent[] = [];

  for (const viewing of viewings) {
    const at = viewing.scheduledAt;
    events.push({
      id: `viewing-${viewing.id}`,
      kind: "VIEWING",
      label: "Показ",
      time: formatUtcTimeOrNull(at),
      sortAt: at.toISOString(),
      day: startOfUtcDay(at).toISOString().slice(0, 10),
      propertyName: viewing.buyerInterest.saleListing.property.name,
      personName: viewing.buyerInterest.buyer.name,
      href: `/crm/sales/clients/${viewing.buyerInterest.buyer.id}`,
      amount: null,
      status: viewing.status,
    });
  }

  for (const deposit of deposits) {
    const at = deposit.status === "PAID" && deposit.paidAt ? deposit.paidAt : deposit.createdAt;
    events.push({
      id: `deposit-${deposit.id}`,
      kind: "DEPOSIT",
      label: "Задаток",
      time: formatUtcTimeOrNull(at),
      sortAt: at.toISOString(),
      day: startOfUtcDay(at).toISOString().slice(0, 10),
      propertyName: deposit.buyerInterest.saleListing.property.name,
      personName: deposit.buyerInterest.buyer.name,
      href: `/crm/sales/clients/${deposit.buyerInterest.buyer.id}`,
      amount: deposit.amount,
      status: deposit.status,
    });
  }

  for (const purchase of purchases) {
    const listing = purchase.buyerInterest?.saleListing;
    const at = purchase.createdAt;
    events.push({
      id: `purchase-${purchase.id}`,
      kind: "PURCHASE",
      label: "Сделка",
      time: formatUtcTimeOrNull(at),
      sortAt: at.toISOString(),
      day: startOfUtcDay(at).toISOString().slice(0, 10),
      propertyName: listing?.property.name ?? "Объект продажи",
      personName: purchase.buyer.name,
      href: listing
        ? `/crm/sales/properties/${listing.id}`
        : `/crm/sales/clients/${purchase.buyer.id}`,
      amount: null,
      status: "PURCHASED",
    });
  }

  events.sort(compareSalesEvents);

  return {
    year: input.year,
    month: input.month,
    from: monthStart.toISOString(),
    to: monthEnd.toISOString(),
    events,
    days: summarizeDays(events),
    knownGaps: ["SALES_EVENT_DATE_GAP"],
  };
}

export function parseSalesCalendarMonth(searchParams: URLSearchParams) {
  const now = new Date();
  const yearRaw = Number(searchParams.get("year") ?? now.getUTCFullYear());
  const monthRaw = Number(searchParams.get("month") ?? now.getUTCMonth() + 1);
  const year =
    Number.isInteger(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100
      ? yearRaw
      : now.getUTCFullYear();
  const month =
    Number.isInteger(monthRaw) && monthRaw >= 1 && monthRaw <= 12
      ? monthRaw
      : now.getUTCMonth() + 1;
  return { year, month };
}

export function parseSalesCalendarRange(searchParams: URLSearchParams) {
  const fromRaw = searchParams.get("from");
  const toRaw = searchParams.get("to");
  const from = fromRaw ? parseDateOnly(fromRaw) : null;
  const to = toRaw ? parseDateOnly(toRaw) : null;

  if (from && to && from < to) {
    return {
      year: from.getUTCFullYear(),
      month: from.getUTCMonth() + 1,
      from,
      to,
    };
  }

  const { year, month } = parseSalesCalendarMonth(searchParams);
  return {
    year,
    month,
    from: startOfUtcMonth(year, month),
    to: startOfNextUtcMonth(year, month),
  };
}
