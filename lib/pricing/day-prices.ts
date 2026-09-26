import { z } from "zod";
import { addUtcDays, parseDateOnly, startOfUtcDay } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/**
 * Nightly price overrides for the occupancy calendar (Stage 16.0).
 *
 * Effective nightly price for a (property, day) is:
 *   PropertyDayPrice.price (override)  ??  Property.dailyPrice (base)  ??  null
 *
 * This is a planning/tariff layer only. It never recomputes Booking.totalAmount
 * (the immutable source of truth) and has no effect on finance aggregation.
 */

export const DAY_PRICE_MIN = 0;
/** Sanity cap for a nightly price in integer RUB (100 000 000 ₽). */
export const DAY_PRICE_MAX = 100_000_000;
/** Guard against unbounded range writes. */
export const DAY_PRICE_MAX_RANGE_DAYS = 370;

export class PricingDomainError extends Error {
  constructor(
    public code: "VALIDATION" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "PricingDomainError";
  }
}

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату ГГГГ-ММ-ДД");

export const setDayPriceRangeSchema = z
  .object({
    propertyId: z.string().trim().min(1, "Укажите объект"),
    dateFrom: isoDate,
    dateTo: isoDate,
    /** null → сбросить override (вернуть к базовой Property.dailyPrice). */
    price: z
      .number()
      .int("Цена — целое число")
      .min(DAY_PRICE_MIN, "Цена не может быть отрицательной")
      .max(DAY_PRICE_MAX, "Слишком большая цена")
      .nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.dateFrom > data.dateTo) {
      ctx.addIssue({
        code: "custom",
        message: "Начало периода позже конца",
        path: ["dateTo"],
      });
    }
  });

export type SetDayPriceRangeInput = z.infer<typeof setDayPriceRangeSchema>;

export type EffectiveDayPrice = {
  /** Effective nightly price, or null when no override and no base price. */
  price: number | null;
  /** True when a manual override exists for this exact day. */
  isOverride: boolean;
};

export type DayPriceData = {
  /** Base Property.dailyPrice per property id (may be null). */
  basePriceByProperty: Record<string, number | null>;
  /** Manual overrides: propertyId → { "YYYY-MM-DD": price }. */
  overrides: Record<string, Record<string, number>>;
};

function eachDayIso(fromIso: string, toIso: string): string[] {
  const from = parseDateOnly(fromIso);
  const to = parseDateOnly(toIso);
  if (!from || !to) return [];
  const out: string[] = [];
  for (let cursor = from; cursor <= to; cursor = addUtcDays(cursor, 1)) {
    out.push(cursor.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Load base prices + nightly overrides for a set of properties over an inclusive
 * date range. Returns compact data (only real overrides), not a full matrix.
 */
export async function getDayPriceData(input: {
  propertyIds: string[];
  dateFrom: string;
  dateTo: string;
}): Promise<DayPriceData> {
  const propertyIds = [...new Set(input.propertyIds)];
  if (propertyIds.length === 0) {
    return { basePriceByProperty: {}, overrides: {} };
  }

  const from = parseDateOnly(input.dateFrom);
  const to = parseDateOnly(input.dateTo);
  if (!from || !to || from > to) {
    return { basePriceByProperty: {}, overrides: {} };
  }

  const [properties, overrideRows] = await Promise.all([
    prisma.property.findMany({
      where: { id: { in: propertyIds } },
      select: { id: true, dailyPrice: true },
    }),
    prisma.propertyDayPrice.findMany({
      where: {
        propertyId: { in: propertyIds },
        date: { gte: from, lt: addUtcDays(to, 1) },
      },
      select: { propertyId: true, date: true, price: true },
    }),
  ]);

  const basePriceByProperty: Record<string, number | null> = {};
  for (const p of properties) {
    basePriceByProperty[p.id] = p.dailyPrice ?? null;
  }

  const overrides: Record<string, Record<string, number>> = {};
  for (const row of overrideRows) {
    const iso = row.date.toISOString().slice(0, 10);
    (overrides[row.propertyId] ??= {})[iso] = row.price;
  }

  return { basePriceByProperty, overrides };
}

/** Resolve the effective nightly price for one (property, day). */
export function effectiveDayPrice(
  data: DayPriceData,
  propertyId: string,
  dateIso: string,
): EffectiveDayPrice {
  const override = data.overrides[propertyId]?.[dateIso];
  if (override != null) {
    return { price: override, isOverride: true };
  }
  const base = data.basePriceByProperty[propertyId];
  return { price: base ?? null, isOverride: false };
}

/**
 * Set (or reset) the nightly price for every day in an inclusive range.
 * - price is a non-negative integer → upsert an override for each day.
 * - price is null → delete overrides in the range (fall back to base price).
 * Never touches bookings or financial transactions.
 */
export async function setDayPriceRange(
  input: SetDayPriceRangeInput,
): Promise<{ affectedDays: number }> {
  const property = await prisma.property.findUnique({
    where: { id: input.propertyId },
    select: { id: true },
  });
  if (!property) {
    throw new PricingDomainError("NOT_FOUND", "Объект не найден");
  }

  const days = eachDayIso(input.dateFrom, input.dateTo);
  if (days.length === 0) {
    throw new PricingDomainError("VALIDATION", "Некорректный период");
  }
  if (days.length > DAY_PRICE_MAX_RANGE_DAYS) {
    throw new PricingDomainError(
      "VALIDATION",
      `Период слишком большой (максимум ${DAY_PRICE_MAX_RANGE_DAYS} дней)`,
    );
  }

  const dates = days.map((iso) => startOfUtcDay(iso));

  if (input.price === null) {
    const deleted = await prisma.propertyDayPrice.deleteMany({
      where: { propertyId: input.propertyId, date: { in: dates } },
    });
    return { affectedDays: deleted.count };
  }

  const price = input.price;
  await prisma.$transaction(
    dates.map((date) =>
      prisma.propertyDayPrice.upsert({
        where: { propertyId_date: { propertyId: input.propertyId, date } },
        create: { propertyId: input.propertyId, date, price },
        update: { price },
      }),
    ),
  );

  return { affectedDays: dates.length };
}
