/**
 * Property unit economics (Stage 12.4).
 * OWN vs COMMISSION business revenue; gross rent vs operator P&L.
 */

import type { FinancialCategory, ManagementType, RentCollectionMode } from "@prisma/client";
import { sumMoney } from "@/lib/finance/money";
import {
  calculateCommissionReceived,
  calculateCommissionReceivable,
  calculateCommissionOverpayment,
} from "@/lib/finance/commission-finance";
import { applyCommissionBps } from "@/lib/finance/money";
import { OPERATOR_EXPENSE_CATEGORIES } from "@/lib/finance/types";
import { prisma } from "@/lib/prisma";

export type EconomicsFilters = {
  dateFrom?: string;
  dateTo?: string;
};

export type PropertyEconomics = {
  propertyId: string;
  managementType: ManagementType;
  rentCollectionMode: RentCollectionMode;
  currency: "RUB";
  grossRent: number;
  ownRentalRevenue: number;
  commissionAccrued: number;
  commissionReceived: number;
  commissionReceivable: number;
  commissionOverpayment: number;
  businessRevenue: number;
  expensesByCategory: Record<string, number>;
  totalExpenses: number;
  netProfit: number;
  shortTerm: { grossRent: number; ownRentalRevenue: number; commissionAccrued: number };
  longTerm: { grossRent: number; commissionAccrued: number };
};

export type BusinessEconomics = {
  currency: "RUB";
  grossRent: number;
  businessRevenue: number;
  commissionReceived: number;
  commissionAccrued: number;
  totalOperatorExpenses: number;
  netProfit: number;
  propertyCount: number;
};

function dayStart(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function dayEnd(isoDate: string) {
  return new Date(`${isoDate}T23:59:59.999Z`);
}

/** ST+LT paid rent; deposits excluded; ST refunds reduce gross. */
export async function calculateGrossRent(
  propertyId: string,
  filters?: EconomicsFilters,
): Promise<{ total: number; shortTerm: number; longTerm: number }> {
  const payments = await prisma.bookingPayment.findMany({
    where: {
      booking: { propertyId },
      ...(filters?.dateFrom || filters?.dateTo
        ? {
            paidAt: {
              ...(filters.dateFrom ? { gte: dayStart(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: dayEnd(filters.dateTo) } : {}),
            },
          }
        : {}),
    },
    include: { refunds: true },
  });

  let shortTerm = 0;
  for (const p of payments) {
    const refunded = sumMoney(p.refunds.map((r) => r.amount));
    shortTerm += p.amount - refunded;
  }

  const ltPayments = await prisma.longTermPayment.findMany({
    where: {
      contract: { propertyId },
      ...(filters?.dateFrom || filters?.dateTo
        ? {
            paidAt: {
              ...(filters.dateFrom ? { gte: dayStart(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: dayEnd(filters.dateTo) } : {}),
            },
          }
        : {}),
    },
    include: {
      allocations: { include: { charge: { select: { type: true } } } },
    },
  });

  let longTerm = 0;
  for (const p of ltPayments) {
    longTerm += sumMoney(
      p.allocations.filter((a) => a.charge.type === "RENT").map((a) => a.amount),
    );
  }

  return { total: shortTerm + longTerm, shortTerm, longTerm };
}

/** OWN only: net paid short-term rent. COMMISSION → 0. */
export async function calculateOwnRentalRevenue(
  propertyId: string,
  filters?: EconomicsFilters,
): Promise<number> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { managementType: true },
  });
  if (!property || property.managementType !== "OWN") return 0;

  const gross = await calculateGrossRent(propertyId, filters);
  return gross.total;
}

export async function calculatePropertyCommissionAccrued(
  propertyId: string,
  filters?: EconomicsFilters,
): Promise<{ total: number; shortTerm: number; longTerm: number }> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { managementType: true },
  });
  if (!property || property.managementType !== "COMMISSION") {
    return { total: 0, shortTerm: 0, longTerm: 0 };
  }

  const bookings = await prisma.booking.findMany({
    where: { propertyId },
    select: { id: true, commissionRateBps: true },
  });

  let shortTerm = 0;
  for (const booking of bookings) {
    const payments = await prisma.bookingPayment.findMany({
      where: {
        bookingId: booking.id,
        ...(filters?.dateFrom || filters?.dateTo
          ? {
              paidAt: {
                ...(filters.dateFrom ? { gte: dayStart(filters.dateFrom) } : {}),
                ...(filters.dateTo ? { lte: dayEnd(filters.dateTo) } : {}),
              },
            }
          : {}),
      },
      include: { refunds: true },
    });
    const paid = sumMoney(payments.map((p) => p.amount));
    const refunded = sumMoney(payments.flatMap((p) => p.refunds.map((r) => r.amount)));
    const netPaid = paid - refunded;
    if (netPaid <= 0 || booking.commissionRateBps == null) continue;
    shortTerm += applyCommissionBps(netPaid, booking.commissionRateBps);
  }

  const contracts = await prisma.longTermContract.findMany({
    where: { propertyId },
    select: { id: true, commissionRateBps: true },
  });

  let longTerm = 0;
  for (const contract of contracts) {
    const payments = await prisma.longTermPayment.findMany({
      where: {
        contractId: contract.id,
        ...(filters?.dateFrom || filters?.dateTo
          ? {
              paidAt: {
                ...(filters.dateFrom ? { gte: dayStart(filters.dateFrom) } : {}),
                ...(filters.dateTo ? { lte: dayEnd(filters.dateTo) } : {}),
              },
            }
          : {}),
      },
      include: {
        allocations: { include: { charge: { select: { type: true } } } },
      },
    });
    let rentPaid = 0;
    for (const p of payments) {
      rentPaid += sumMoney(
        p.allocations.filter((a) => a.charge.type === "RENT").map((a) => a.amount),
      );
    }
    if (rentPaid > 0) {
      longTerm += applyCommissionBps(rentPaid, contract.commissionRateBps);
    }
  }

  return { total: shortTerm + longTerm, shortTerm, longTerm };
}

export async function calculatePropertyOperatorExpenses(
  propertyId: string | null,
  filters?: EconomicsFilters,
  opts?: { includeGlobal?: boolean },
): Promise<{ total: number; byCategory: Record<string, number> }> {
  const categories = OPERATOR_EXPENSE_CATEGORIES as readonly FinancialCategory[];
  const where = {
    type: "EXPENSE" as const,
    category: { in: [...categories] },
    OR: [
      ...(propertyId ? [{ propertyId }] : []),
      ...(opts?.includeGlobal && propertyId ? [{ propertyId: null }] : []),
      ...(!propertyId ? [{ propertyId: null }] : []),
    ],
    ...(filters?.dateFrom || filters?.dateTo
      ? {
          occurredAt: {
            ...(filters.dateFrom ? { gte: dayStart(filters.dateFrom) } : {}),
            ...(filters.dateTo ? { lte: dayEnd(filters.dateTo) } : {}),
          },
        }
      : {}),
  };

  const rows = await prisma.financialTransaction.findMany({
    where: propertyId
      ? {
          type: "EXPENSE",
          category: { in: [...categories] },
          AND: [
            {
              OR: [
                { propertyId },
                ...(opts?.includeGlobal ? [{ propertyId: null }] : []),
              ],
            },
            {
              OR: [
                { economicRole: "BUSINESS_EXPENSE" },
                { economicRole: null, expenseResponsibility: { not: "OWNER" } },
              ],
            },
          ],
          ...(filters?.dateFrom || filters?.dateTo
            ? {
                occurredAt: {
                  ...(filters.dateFrom ? { gte: dayStart(filters.dateFrom) } : {}),
                  ...(filters.dateTo ? { lte: dayEnd(filters.dateTo) } : {}),
                },
              }
            : {}),
        }
      : where,
    select: { category: true, amount: true, economicRole: true, expenseResponsibility: true },
  });

  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    if (row.economicRole && row.economicRole !== "BUSINESS_EXPENSE") continue;
    if (!row.economicRole && row.expenseResponsibility === "OWNER") continue;
    byCategory[row.category] = (byCategory[row.category] ?? 0) + row.amount;
    total += row.amount;
  }
  return { total, byCategory };
}

export function classifyBusinessRevenue(input: {
  managementType: ManagementType;
  ownRentalRevenue: number;
  commissionReceived: number;
}): number {
  if (input.managementType === "OWN") return input.ownRentalRevenue;
  return input.commissionReceived;
}

export async function calculatePropertyEconomics(
  propertyId: string,
  filters?: EconomicsFilters,
): Promise<PropertyEconomics> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { managementType: true, rentCollectionMode: true },
  });
  if (!property) {
    throw new Error("Property not found");
  }

  const gross = await calculateGrossRent(propertyId, filters);
  const ownRentalRevenue = await calculateOwnRentalRevenue(propertyId, filters);
  const commission = await calculatePropertyCommissionAccrued(propertyId, filters);
  const commissionReceived = await calculateCommissionReceived({ propertyId, ...filters });
  const expenses = await calculatePropertyOperatorExpenses(propertyId, filters);

  const businessRevenue = classifyBusinessRevenue({
    managementType: property.managementType,
    ownRentalRevenue,
    commissionReceived,
  });

  return {
    propertyId,
    managementType: property.managementType,
    rentCollectionMode: property.rentCollectionMode,
    currency: "RUB",
    grossRent: gross.total,
    ownRentalRevenue,
    commissionAccrued: commission.total,
    commissionReceived,
    commissionReceivable: calculateCommissionReceivable(commission.total, commissionReceived),
    commissionOverpayment: calculateCommissionOverpayment(commission.total, commissionReceived),
    businessRevenue,
    expensesByCategory: expenses.byCategory,
    totalExpenses: expenses.total,
    netProfit: businessRevenue - expenses.total,
    shortTerm: {
      grossRent: gross.shortTerm,
      ownRentalRevenue: property.managementType === "OWN" ? gross.shortTerm : 0,
      commissionAccrued: commission.shortTerm,
    },
    longTerm: {
      grossRent: gross.longTerm,
      commissionAccrued: commission.longTerm,
    },
  };
}

export async function calculateBusinessEconomics(
  filters?: EconomicsFilters & { propertyId?: string },
): Promise<BusinessEconomics> {
  const properties = await prisma.property.findMany({
    where: filters?.propertyId ? { id: filters.propertyId } : undefined,
    select: { id: true, managementType: true },
  });

  let grossRent = 0;
  let businessRevenue = 0;
  let commissionReceived = 0;
  let commissionAccrued = 0;

  for (const p of properties) {
    const econ = await calculatePropertyEconomics(p.id, filters);
    grossRent += econ.grossRent;
    businessRevenue += econ.businessRevenue;
    commissionReceived += econ.commissionReceived;
    commissionAccrued += econ.commissionAccrued;
  }

  const globalExpenses = await calculatePropertyOperatorExpenses(null, filters);
  const propertyExpenses = filters?.propertyId
    ? (await calculatePropertyOperatorExpenses(filters.propertyId, filters)).total
    : (
        await prisma.financialTransaction.groupBy({
          by: ["propertyId"],
          where: {
            type: "EXPENSE",
            category: { in: [...OPERATOR_EXPENSE_CATEGORIES] },
            propertyId: { not: null },
            OR: [
              { economicRole: "BUSINESS_EXPENSE" },
              { economicRole: null, expenseResponsibility: { not: "OWNER" } },
            ],
            ...(filters?.dateFrom || filters?.dateTo
              ? {
                  occurredAt: {
                    ...(filters.dateFrom ? { gte: dayStart(filters.dateFrom) } : {}),
                    ...(filters.dateTo ? { lte: dayEnd(filters.dateTo) } : {}),
                  },
                }
              : {}),
          },
          _sum: { amount: true },
        })
      ).reduce((s, g) => s + (g._sum.amount ?? 0), 0);

  const totalOperatorExpenses = propertyExpenses + globalExpenses.total;

  return {
    currency: "RUB",
    grossRent,
    businessRevenue,
    commissionReceived,
    commissionAccrued,
    totalOperatorExpenses,
    netProfit: businessRevenue - totalOperatorExpenses,
    propertyCount: properties.length,
  };
}

/** Whether an INCOME row counts toward business revenue (not cash ledger). */
export function classifyEconomicRevenue(input: {
  managementType: ManagementType;
  category: FinancialCategory;
  economicRole: string | null;
}): "business" | "pass_through" | "none" {
  if (input.economicRole === "BUSINESS_REVENUE") return "business";
  if (input.economicRole === "PASS_THROUGH") return "pass_through";
  if (input.economicRole === "NEUTRAL") return "none";
  // Legacy fallback
  if (input.managementType === "OWN" && input.category === "RENT_PAYMENT") return "business";
  if (input.category === "OPERATOR_COMMISSION") return "business";
  return "pass_through";
}
