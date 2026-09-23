import { z } from "zod";

export const FINANCE_SEGMENTS = ["ALL", "SHORT_TERM", "LONG_TERM", "SALES"] as const;
export const FINANCE_MANAGEMENT_FILTERS = ["ALL", "OWN", "COMMISSION"] as const;
export const FINANCE_PERIOD_PRESETS = [
  "today",
  "week",
  "month",
  "quarter",
  "year",
  "custom",
] as const;

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату ГГГГ-ММ-ДД");

export const financeDashboardQuerySchema = z
  .object({
    period: z.enum(FINANCE_PERIOD_PRESETS).optional().default("month"),
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
    propertyId: z.string().trim().min(1).optional(),
    managementType: z.enum(FINANCE_MANAGEMENT_FILTERS).optional().default("ALL"),
    segment: z.enum(FINANCE_SEGMENTS).optional().default("ALL"),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.period === "custom") {
      if (!data.dateFrom || !data.dateTo) {
        ctx.addIssue({
          code: "custom",
          message: "Для произвольного периода укажите dateFrom и dateTo",
          path: ["dateFrom"],
        });
      }
    }
    if (data.dateFrom && data.dateTo && data.dateFrom > data.dateTo) {
      ctx.addIssue({
        code: "custom",
        message: "dateFrom позже dateTo",
        path: ["dateTo"],
      });
    }
  });

export type FinanceDashboardQuery = z.infer<typeof financeDashboardQuerySchema>;
export type FinanceSegment = (typeof FINANCE_SEGMENTS)[number];
export type FinanceManagementFilter = (typeof FINANCE_MANAGEMENT_FILTERS)[number];
export type FinancePeriodPreset = (typeof FINANCE_PERIOD_PRESETS)[number];

/** Resolve UTC calendar date range for preset (inclusive ISO dates). */
export function resolveDashboardPeriod(input: {
  period: FinancePeriodPreset;
  dateFrom?: string;
  dateTo?: string;
  now?: Date;
}): { dateFrom: string; dateTo: string; previousFrom: string; previousTo: string } {
  const now = input.now ?? new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();

  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (yy: number, mm: number, dd: number) =>
    `${yy}-${pad(mm + 1)}-${pad(dd)}`;

  const daysInMonth = (yy: number, mm: number) => new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();

  let dateFrom: string;
  let dateTo: string;
  let previousFrom: string;
  let previousTo: string;

  switch (input.period) {
    case "today": {
      dateFrom = iso(y, m, d);
      dateTo = dateFrom;
      const prev = new Date(Date.UTC(y, m, d - 1));
      previousFrom = iso(prev.getUTCFullYear(), prev.getUTCMonth(), prev.getUTCDate());
      previousTo = previousFrom;
      break;
    }
    case "week": {
      const dow = now.getUTCDay(); // 0 Sun
      const mondayOffset = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(Date.UTC(y, m, d + mondayOffset));
      const sunday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6));
      dateFrom = iso(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate());
      dateTo = iso(sunday.getUTCFullYear(), sunday.getUTCMonth(), sunday.getUTCDate());
      const prevMon = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() - 7));
      const prevSun = new Date(Date.UTC(prevMon.getUTCFullYear(), prevMon.getUTCMonth(), prevMon.getUTCDate() + 6));
      previousFrom = iso(prevMon.getUTCFullYear(), prevMon.getUTCMonth(), prevMon.getUTCDate());
      previousTo = iso(prevSun.getUTCFullYear(), prevSun.getUTCMonth(), prevSun.getUTCDate());
      break;
    }
    case "quarter": {
      const q = Math.floor(m / 3);
      const startM = q * 3;
      dateFrom = iso(y, startM, 1);
      dateTo = iso(y, startM + 2, daysInMonth(y, startM + 2));
      const pq = q === 0 ? 3 : q - 1;
      const py = q === 0 ? y - 1 : y;
      const pStart = pq * 3;
      previousFrom = iso(py, pStart, 1);
      previousTo = iso(py, pStart + 2, daysInMonth(py, pStart + 2));
      break;
    }
    case "year": {
      dateFrom = iso(y, 0, 1);
      dateTo = iso(y, 11, 31);
      previousFrom = iso(y - 1, 0, 1);
      previousTo = iso(y - 1, 11, 31);
      break;
    }
    case "custom": {
      dateFrom = input.dateFrom!;
      dateTo = input.dateTo!;
      const from = new Date(`${dateFrom}T12:00:00.000Z`);
      const to = new Date(`${dateTo}T12:00:00.000Z`);
      const lenMs = to.getTime() - from.getTime();
      const prevTo = new Date(from.getTime() - 86400000);
      const prevFrom = new Date(prevTo.getTime() - lenMs);
      previousFrom = iso(prevFrom.getUTCFullYear(), prevFrom.getUTCMonth(), prevFrom.getUTCDate());
      previousTo = iso(prevTo.getUTCFullYear(), prevTo.getUTCMonth(), prevTo.getUTCDate());
      break;
    }
    case "month":
    default: {
      dateFrom = iso(y, m, 1);
      dateTo = iso(y, m, daysInMonth(y, m));
      const pm = m === 0 ? 11 : m - 1;
      const py = m === 0 ? y - 1 : y;
      previousFrom = iso(py, pm, 1);
      previousTo = iso(py, pm, daysInMonth(py, pm));
      break;
    }
  }

  return { dateFrom, dateTo, previousFrom, previousTo };
}
