/**
 * Stage 12.5 Financial Dashboard aggregation.
 * Single source of truth for overview KPIs, donuts, timeline, tables.
 *
 * SALES_FINANCE_REVENUE_GAP: SaleListing.price / Deposit / PURCHASED
 * are never business revenue. Sales segment is empty with explicit status.
 *
 * Negative profit: donut slices use only positive contributions;
 * losses listed separately in lossMakingItems.
 *
 * General expenses (propertyId=null): in business net profit,
 * not allocated to Property rows. Reconciliation:
 * sum(propertyNetProfit) - generalExpenses = businessNetProfit
 * (when no segment filter excludes general).
 */

import type { FinancialCategory, ManagementType } from "@prisma/client";
import { calculateCommissionReceived } from "@/lib/finance/commission-finance";
import {
  calculateGrossRent,
  calculatePropertyCommissionAccrued,
  calculatePropertyEconomics,
  calculatePropertyOperatorExpenses,
} from "@/lib/finance/property-economics";
import {
  financeDashboardQuerySchema,
  resolveDashboardPeriod,
  type FinanceDashboardQuery,
  type FinanceSegment,
} from "@/lib/finance/dashboard-validation";
import { OPERATOR_EXPENSE_CATEGORIES, financialCategoryLabels } from "@/lib/finance/types";
import { FinanceDomainError, sumMoney } from "@/lib/finance/money";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/property-labels";

export type DonutSlice = {
  id: string;
  label: string;
  amount: number;
  percent: number;
};

export type FinanceDashboardDto = {
  filters: {
    period: string;
    dateFrom: string;
    dateTo: string;
    propertyId: string | null;
    managementType: string;
    segment: string;
  };
  summary: {
    grossRent: number;
    businessRevenue: number;
    totalExpenses: number;
    netProfit: number;
    currency: "RUB";
  };
  comparison: {
    available: boolean;
    previousFrom: string;
    previousTo: string;
    grossRentChangePct: number | null;
    businessRevenueChangePct: number | null;
    expensesChangePct: number | null;
    netProfitChangePct: number | null;
  };
  reconciliation: {
    propertiesNetProfit: number;
    generalExpenses: number;
    businessNetProfit: number;
  };
  profitBySegment: DonutSlice[];
  expensesBySegment: DonutSlice[];
  expenseCategories: DonutSlice[];
  lossMakingItems: Array<{
    id: string;
    label: string;
    segment: FinanceSegment | "PROPERTY";
    netProfit: number;
  }>;
  timeline: Array<{
    bucket: string;
    label: string;
    grossRent: number;
    businessRevenue: number;
    expenses: number;
    netProfit: number;
  }>;
  timelineGranularity: "day" | "week" | "month";
  propertyEconomics: Array<{
    propertyId: string;
    name: string;
    managementType: ManagementType;
    rentCollectionMode: string;
    grossRent: number;
    businessRevenue: number;
    totalExpenses: number;
    netProfit: number;
    commissionRateHint: number | null;
  }>;
  commissionSummary: {
    accrued: number;
    received: number;
    receivable: number;
    overpayment: number;
    byProperty: Array<{
      propertyId: string;
      name: string;
      rateDaily: number | null;
      rateMonthly: number | null;
      accrued: number;
      received: number;
      receivable: number;
      overpayment: number;
    }>;
  };
  recentTransactions: Array<{
    id: string;
    occurredAt: string;
    description: string | null;
    propertyName: string | null;
    category: string;
    categoryLabel: string;
    economicRole: string | null;
    amount: number;
    signedAmount: number;
    type: string;
  }>;
  salesFinanceStatus: {
    ready: false;
    gap: "SALES_FINANCE_REVENUE_GAP";
    message: string;
  };
};

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) return 0;
    return null;
  }
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

function toSlices(
  rows: Array<{ id: string; label: string; amount: number }>,
): DonutSlice[] {
  const positive = rows.filter((r) => r.amount > 0);
  const total = sumMoney(positive.map((r) => r.amount));
  if (total <= 0) return [];
  return positive.map((r) => ({
    id: r.id,
    label: r.label,
    amount: r.amount,
    percent: Math.round((r.amount / total) * 1000) / 10,
  }));
}

function dayStart(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}
function dayEnd(iso: string) {
  return new Date(`${iso}T23:59:59.999Z`);
}

function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = dayStart(from);
  const end = dayStart(to);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur = new Date(cur.getTime() + 86400000);
  }
  return out;
}

function eachMonth(from: string, to: string): string[] {
  const out: string[] = [];
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  let y = fy!;
  let m = fm! - 1;
  const endY = ty!;
  const endM = tm! - 1;
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m + 1).padStart(2, "0")}`);
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return out;
}

async function listScopedProperties(filters: {
  propertyId?: string;
  managementType: string;
}) {
  return prisma.property.findMany({
    where: {
      ...(filters.propertyId ? { id: filters.propertyId } : {}),
      ...(filters.managementType === "OWN" || filters.managementType === "COMMISSION"
        ? { managementType: filters.managementType }
        : {}),
    },
    select: {
      id: true,
      name: true,
      managementType: true,
      rentCollectionMode: true,
      commissionDaily: true,
      commissionMonthly: true,
    },
    orderBy: { name: "asc" },
  });
}

/** Attribute expense FT to dashboard segment. */
export function classifyExpenseSegment(row: {
  propertyId: string | null;
  bookingId: string | null;
  longTermContractId: string | null;
}): "SHORT_TERM" | "LONG_TERM" | "GENERAL" | "SALES" {
  if (row.bookingId) return "SHORT_TERM";
  if (row.longTermContractId) return "LONG_TERM";
  return "GENERAL";
}

async function loadOperatorExpenses(filters: {
  dateFrom: string;
  dateTo: string;
  propertyId?: string;
}) {
  return prisma.financialTransaction.findMany({
    where: {
      type: "EXPENSE",
      category: { in: [...OPERATOR_EXPENSE_CATEGORIES] },
      OR: [
        { economicRole: "BUSINESS_EXPENSE" },
        { economicRole: null, expenseResponsibility: { not: "OWNER" } },
      ],
      occurredAt: { gte: dayStart(filters.dateFrom), lte: dayEnd(filters.dateTo) },
      ...(filters.propertyId
        ? { propertyId: filters.propertyId }
        : {}),
    },
    select: {
      id: true,
      amount: true,
      category: true,
      propertyId: true,
      bookingId: true,
      longTermContractId: true,
      occurredAt: true,
    },
  });
}

async function segmentBusinessRevenue(input: {
  propertyId: string;
  managementType: ManagementType;
  dateFrom: string;
  dateTo: string;
}): Promise<{ shortTerm: number; longTerm: number }> {
  const range = { dateFrom: input.dateFrom, dateTo: input.dateTo };
  if (input.managementType === "OWN") {
    const gross = await calculateGrossRent(input.propertyId, range);
    return { shortTerm: gross.shortTerm, longTerm: gross.longTerm };
  }
  const payments = await prisma.commissionPayment.findMany({
    where: {
      propertyId: input.propertyId,
      paidAt: { gte: dayStart(input.dateFrom), lte: dayEnd(input.dateTo) },
    },
    select: { amount: true, bookingId: true, longTermContractId: true },
  });
  let shortTerm = 0;
  let longTerm = 0;
  for (const p of payments) {
    if (p.bookingId) shortTerm += p.amount;
    else if (p.longTermContractId) longTerm += p.amount;
  }
  return { shortTerm, longTerm };
}

export async function getFinanceDashboard(
  rawQuery: unknown,
): Promise<FinanceDashboardDto> {
  const parsed = financeDashboardQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw new FinanceDomainError("VALIDATION", "Некорректные фильтры dashboard");
  }
  const query = parsed.data as FinanceDashboardQuery;
  const range = resolveDashboardPeriod(query);

  if (query.propertyId) {
    const exists = await prisma.property.findUnique({ where: { id: query.propertyId } });
    if (!exists) throw new FinanceDomainError("NOT_FOUND", "Объект не найден");
  }

  const properties = await listScopedProperties({
    propertyId: query.propertyId,
    managementType: query.managementType,
  });

  const current = await aggregateDashboard(properties, range.dateFrom, range.dateTo, query.segment);
  const previous = await aggregateDashboard(
    properties,
    range.previousFrom,
    range.previousTo,
    query.segment,
  );

  const comparisonAvailable =
    query.period !== "custom" || Boolean(query.dateFrom && query.dateTo);

  const profitBySegment = toSlices([
    { id: "SHORT_TERM", label: "Посуточная аренда", amount: Math.max(0, current.stProfit) },
    { id: "LONG_TERM", label: "Долгосрочная аренда", amount: Math.max(0, current.ltProfit) },
  ]);

  const expensesBySegment = toSlices([
    { id: "SHORT_TERM", label: "Посуточная аренда", amount: current.stExpenses },
    { id: "LONG_TERM", label: "Долгосрочная аренда", amount: current.ltExpenses },
    { id: "GENERAL", label: "Общие расходы", amount: current.generalExpenses },
  ]);

  const expenseCategories = toSlices(
    Object.entries(current.categoryMap).map(([cat, amount]) => ({
      id: cat,
      label: financialCategoryLabels[cat as FinancialCategory] ?? cat,
      amount,
    })),
  );

  const commissionByProperty = [];
  for (const p of properties.filter((x) => x.managementType === "COMMISSION")) {
    const accrued = await calculatePropertyCommissionAccrued(p.id, {
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
    });
    const received = await calculateCommissionReceived({
      propertyId: p.id,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
    });
    const receivable = Math.max(accrued.total - received, 0);
    const overpayment = Math.max(received - accrued.total, 0);
    if (accrued.total || received) {
      commissionByProperty.push({
        propertyId: p.id,
        name: p.name,
        rateDaily: p.commissionDaily,
        rateMonthly: p.commissionMonthly,
        accrued: accrued.total,
        received,
        receivable,
        overpayment,
      });
    }
  }

  const commissionSummary = {
    accrued: sumMoney(commissionByProperty.map((c) => c.accrued)),
    received: sumMoney(commissionByProperty.map((c) => c.received)),
    receivable: sumMoney(commissionByProperty.map((c) => c.receivable)),
    overpayment: sumMoney(commissionByProperty.map((c) => c.overpayment)),
    byProperty: commissionByProperty,
  };

  const recent = await prisma.financialTransaction.findMany({
    where: {
      occurredAt: { gte: dayStart(range.dateFrom), lte: dayEnd(range.dateTo) },
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
    },
    include: { property: { select: { name: true } } },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: 15,
  });

  const timeline = await buildTimeline(properties, range.dateFrom, range.dateTo, query.segment);

  return {
    filters: {
      period: query.period,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      propertyId: query.propertyId ?? null,
      managementType: query.managementType,
      segment: query.segment,
    },
    summary: {
      grossRent: current.grossRent,
      businessRevenue: current.businessRevenue,
      totalExpenses: current.totalExpenses,
      netProfit: current.netProfit,
      currency: "RUB",
    },
    comparison: {
      available: comparisonAvailable,
      previousFrom: range.previousFrom,
      previousTo: range.previousTo,
      grossRentChangePct: pctChange(current.grossRent, previous.grossRent),
      businessRevenueChangePct: pctChange(current.businessRevenue, previous.businessRevenue),
      expensesChangePct: pctChange(current.totalExpenses, previous.totalExpenses),
      netProfitChangePct: pctChange(current.netProfit, previous.netProfit),
    },
    reconciliation: {
      propertiesNetProfit: current.propertiesNetProfit,
      generalExpenses: current.generalExpenses,
      businessNetProfit: current.netProfit,
    },
    profitBySegment,
    expensesBySegment,
    expenseCategories,
    lossMakingItems: current.losses,
    timeline: timeline.points,
    timelineGranularity: timeline.granularity,
    propertyEconomics: current.propertyRows,
    commissionSummary,
    recentTransactions: recent.map((tx) => {
      const signed =
        tx.type === "EXPENSE" || tx.type === "OWNER_PAYOUT"
          ? -tx.amount
          : tx.type === "ADJUSTMENT" && tx.adjustmentDirection === "DEBIT"
            ? -tx.amount
            : tx.amount;
      return {
        id: tx.id,
        occurredAt: tx.occurredAt.toISOString(),
        description: tx.description,
        propertyName: tx.property?.name ?? null,
        category: tx.category,
        categoryLabel: financialCategoryLabels[tx.category] ?? tx.category,
        economicRole: tx.economicRole,
        amount: tx.amount,
        signedAmount: signed,
        type: tx.type,
      };
    }),
    salesFinanceStatus: {
      ready: false,
      gap: "SALES_FINANCE_REVENUE_GAP",
      message:
        "Модель выручки от продаж отсутствует: SaleListing.price, Deposit и PURCHASED не являются business revenue.",
    },
  };
}

async function aggregateDashboard(
  properties: Awaited<ReturnType<typeof listScopedProperties>>,
  dateFrom: string,
  dateTo: string,
  segment: FinanceSegment,
) {
  const expenses = await loadOperatorExpenses({
    dateFrom,
    dateTo,
  });

  // When multi-property, filter expenses to scoped property ids + null
  const propertyIds = new Set(properties.map((p) => p.id));
  const scopedExpenses = expenses.filter(
    (e) => e.propertyId == null || propertyIds.has(e.propertyId),
  );

  let stExpenses = 0;
  let ltExpenses = 0;
  let generalExpenses = 0;
  const categoryMap: Record<string, number> = {};
  const propExpenseMap = new Map<string, { st: number; lt: number; other: number }>();

  for (const e of scopedExpenses) {
    const seg = classifyExpenseSegment(e);
    if (segment === "SALES") continue;
    if (segment === "SHORT_TERM" && seg !== "SHORT_TERM") continue;
    if (segment === "LONG_TERM" && seg !== "LONG_TERM") continue;

    categoryMap[e.category] = (categoryMap[e.category] ?? 0) + e.amount;

    if (seg === "SHORT_TERM") {
      stExpenses += e.amount;
      if (e.propertyId) {
        const cur = propExpenseMap.get(e.propertyId) ?? { st: 0, lt: 0, other: 0 };
        cur.st += e.amount;
        propExpenseMap.set(e.propertyId, cur);
      }
    } else if (seg === "LONG_TERM") {
      ltExpenses += e.amount;
      if (e.propertyId) {
        const cur = propExpenseMap.get(e.propertyId) ?? { st: 0, lt: 0, other: 0 };
        cur.lt += e.amount;
        propExpenseMap.set(e.propertyId, cur);
      }
    } else {
      // GENERAL or property-only
      if (e.propertyId == null) {
        if (segment === "ALL") generalExpenses += e.amount;
      } else {
        const cur = propExpenseMap.get(e.propertyId) ?? { st: 0, lt: 0, other: 0 };
        cur.other += e.amount;
        propExpenseMap.set(e.propertyId, cur);
        // Unclassified property expenses: count in general for segment ALL,
        // and in property P&L; for ST/LT filters exclude unless matching.
        if (segment === "ALL") {
          // included in property expenses below, not in generalExpenses
        }
      }
    }
  }

  let grossRent = 0;
  let businessRevenue = 0;
  let stRevenue = 0;
  let ltRevenue = 0;
  let stGross = 0;
  let ltGross = 0;
  let propertiesNetProfit = 0;
  const propertyRows: FinanceDashboardDto["propertyEconomics"] = [];
  const losses: FinanceDashboardDto["lossMakingItems"] = [];

  for (const p of properties) {
    const econ = await calculatePropertyEconomics(p.id, { dateFrom, dateTo });
    const rev = await segmentBusinessRevenue({
      propertyId: p.id,
      managementType: p.managementType,
      dateFrom,
      dateTo,
    });

    const exp = propExpenseMap.get(p.id) ?? { st: 0, lt: 0, other: 0 };

    let propGross = econ.grossRent;
    let propRevenue = rev.shortTerm + rev.longTerm;
    let propExpenses = exp.st + exp.lt + exp.other;

    if (segment === "SHORT_TERM") {
      propGross = econ.shortTerm.grossRent;
      propRevenue = rev.shortTerm;
      propExpenses = exp.st;
    } else if (segment === "LONG_TERM") {
      propGross = econ.longTerm.grossRent;
      propRevenue = rev.longTerm;
      propExpenses = exp.lt;
    } else if (segment === "SALES") {
      propGross = 0;
      propRevenue = 0;
      propExpenses = 0;
    }

    const propProfit = propRevenue - propExpenses;
    stRevenue += rev.shortTerm;
    ltRevenue += rev.longTerm;
    stGross += econ.shortTerm.grossRent;
    ltGross += econ.longTerm.grossRent;

    if (segment !== "SALES") {
      grossRent += propGross;
      businessRevenue += propRevenue;
      propertiesNetProfit += propProfit;
    }

    if (propGross || propRevenue || propExpenses) {
      propertyRows.push({
        propertyId: p.id,
        name: p.name,
        managementType: p.managementType,
        rentCollectionMode: p.rentCollectionMode,
        grossRent: propGross,
        businessRevenue: propRevenue,
        totalExpenses: propExpenses,
        netProfit: propProfit,
        commissionRateHint: p.managementType === "COMMISSION" ? p.commissionDaily : null,
      });
      if (propProfit < 0) {
        losses.push({
          id: p.id,
          label: p.name,
          segment: "PROPERTY",
          netProfit: propProfit,
        });
      }
    }
  }

  // Unclassified property expenses already in property rows.
  // For ALL: totalExpenses = property expenses + general (null propertyId)
  const propertyExpenseTotal = propertyRows.reduce((s, r) => s + r.totalExpenses, 0);
  let totalExpenses = propertyExpenseTotal;
  if (segment === "ALL") totalExpenses += generalExpenses;
  if (segment === "SHORT_TERM") totalExpenses = stExpenses;
  if (segment === "LONG_TERM") totalExpenses = ltExpenses;
  if (segment === "SALES") totalExpenses = 0;

  const netProfit = businessRevenue - totalExpenses;
  const stProfit = stRevenue - stExpenses;
  const ltProfit = ltRevenue - ltExpenses;

  if (stProfit < 0) {
    losses.push({
      id: "SHORT_TERM",
      label: "Посуточная аренда",
      segment: "SHORT_TERM",
      netProfit: stProfit,
    });
  }
  if (ltProfit < 0) {
    losses.push({
      id: "LONG_TERM",
      label: "Долгосрочная аренда",
      segment: "LONG_TERM",
      netProfit: ltProfit,
    });
  }

  return {
    grossRent,
    businessRevenue,
    totalExpenses,
    netProfit,
    stRevenue,
    ltRevenue,
    stGross,
    ltGross,
    stExpenses,
    ltExpenses,
    generalExpenses: segment === "ALL" ? generalExpenses : 0,
    categoryMap,
    propertyRows: propertyRows.sort((a, b) => b.netProfit - a.netProfit),
    losses,
    propertiesNetProfit,
    stProfit,
    ltProfit,
  };
}

async function buildTimeline(
  properties: Awaited<ReturnType<typeof listScopedProperties>>,
  dateFrom: string,
  dateTo: string,
  segment: FinanceSegment,
) {
  const days = eachDay(dateFrom, dateTo);
  let granularity: "day" | "week" | "month" = "day";
  let buckets: string[] = days;

  if (days.length > 92) {
    granularity = "month";
    buckets = eachMonth(dateFrom, dateTo);
  } else if (days.length > 40) {
    granularity = "week";
    buckets = [];
    for (let i = 0; i < days.length; i += 7) {
      buckets.push(days[i]!);
    }
  }

  const points: FinanceDashboardDto["timeline"] = [];

  for (const bucket of buckets) {
    let bFrom = bucket;
    let bTo = bucket;
    if (granularity === "month") {
      const [yy, mm] = bucket.split("-").map(Number);
      const last = new Date(Date.UTC(yy!, mm!, 0)).getUTCDate();
      bFrom = `${bucket}-01`;
      bTo = `${bucket}-${String(last).padStart(2, "0")}`;
      if (bFrom < dateFrom) bFrom = dateFrom;
      if (bTo > dateTo) bTo = dateTo;
    } else if (granularity === "week") {
      const idx = days.indexOf(bucket);
      const end = days[Math.min(idx + 6, days.length - 1)]!;
      bTo = end;
    }

    const agg = await aggregateDashboard(properties, bFrom, bTo, segment);
    points.push({
      bucket,
      label:
        granularity === "month"
          ? bucket
          : bFrom === bTo
            ? bFrom
            : `${bFrom.slice(5)}…${bTo.slice(5)}`,
      grossRent: agg.grossRent,
      businessRevenue: agg.businessRevenue,
      expenses: agg.totalExpenses,
      netProfit: agg.netProfit,
    });
  }

  return { points, granularity };
}

/** Drill-down: profit or expenses by property for a segment. */
export async function getFinanceDashboardDrilldown(input: {
  kind: "profit" | "expense";
  segment: "SHORT_TERM" | "LONG_TERM" | "GENERAL";
  dateFrom: string;
  dateTo: string;
  propertyId?: string;
  managementType?: string;
}) {
  const properties = await listScopedProperties({
    propertyId: input.propertyId,
    managementType: input.managementType ?? "ALL",
  });
  const dash = await aggregateDashboard(
    properties,
    input.dateFrom,
    input.dateTo,
    input.segment === "GENERAL" ? "ALL" : input.segment,
  );

  if (input.kind === "profit") {
    const rows = dash.propertyRows
      .map((r) => ({
        id: r.propertyId,
        label: r.name,
        amount: Math.max(0, r.netProfit),
        netProfit: r.netProfit,
      }))
      .filter((r) => r.amount > 0 || r.netProfit < 0);
    return {
      slices: toSlices(rows.map((r) => ({ id: r.id, label: r.label, amount: r.amount }))),
      losses: rows.filter((r) => r.netProfit < 0),
      total: sumMoney(rows.filter((r) => r.netProfit > 0).map((r) => r.netProfit)),
    };
  }

  if (input.segment === "GENERAL") {
    const global = await calculatePropertyOperatorExpenses(null, {
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
    });
    return {
      slices: toSlices(
        Object.entries(global.byCategory).map(([cat, amount]) => ({
          id: cat,
          label: financialCategoryLabels[cat as FinancialCategory] ?? cat,
          amount,
        })),
      ),
      losses: [],
      total: global.total,
    };
  }

  return {
    slices: toSlices(
      dash.propertyRows
        .filter((r) => r.totalExpenses > 0)
        .map((r) => ({ id: r.propertyId, label: r.name, amount: r.totalExpenses })),
    ),
    losses: [],
    total: sumMoney(dash.propertyRows.map((r) => r.totalExpenses)),
  };
}

export async function getPropertyExpenseCategoriesDrilldown(input: {
  propertyId: string;
  dateFrom: string;
  dateTo: string;
}) {
  const expenses = await calculatePropertyOperatorExpenses(input.propertyId, {
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  });
  return {
    slices: toSlices(
      Object.entries(expenses.byCategory).map(([cat, amount]) => ({
        id: cat,
        label: financialCategoryLabels[cat as FinancialCategory] ?? cat,
        amount,
      })),
    ),
    total: expenses.total,
  };
}

export { formatMoney };
