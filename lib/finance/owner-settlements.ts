/**
 * Owner settlements (Stage 12.4).
 *
 * Balance is derived — never a mutable Owner.balance field.
 *
 * balanceDue =
 *   shortTermOwnerShareOnPaid
 * + longTermOwnerShareOnPaid
 * - ownerExpenses
 * - ownerPayouts
 * + ownerAdjustmentsNet
 *
 * Shares use Booking/LongTerm commission snapshots and PAID cash only.
 * OWN properties never contribute. Deposit excluded. Legacy expenses (null responsibility) = OPERATOR.
 */

import type { ManagementType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  FinanceDomainError,
  applyCommissionBps,
  assertPositiveMoney,
  sumMoney,
} from "@/lib/finance/money";
import type {
  CreateOwnerInput,
  CreateOwnerPayoutInput,
  CreateOwnerSettlementInput,
  OwnerFinanceQuery,
  UpdateOwnerInput,
} from "@/lib/finance/owner-settlements-validation";
import { prisma } from "@/lib/prisma";

const BPS_FULL = 10_000;

export function ownerPayoutSourceKey(payoutId: string) {
  return `OWNER_PAYOUT:${payoutId}`;
}

function dayStart(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}
function dayEnd(iso: string) {
  return new Date(`${iso}T23:59:59.999Z`);
}

function inRange(d: Date, from?: string, to?: string) {
  if (from && d < dayStart(from)) return false;
  if (to && d > dayEnd(to)) return false;
  return true;
}

function ownerShareFromNet(netReceived: number, bps: number, managementType: ManagementType) {
  if (managementType === "OWN" || netReceived <= 0) return { commission: 0, ownerShare: 0 };
  const rate = Math.min(Math.max(bps, 0), BPS_FULL);
  const commission = applyCommissionBps(netReceived, rate);
  return { commission, ownerShare: netReceived - commission };
}

export async function createOwner(input: CreateOwnerInput) {
  return prisma.owner.create({
    data: {
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      notes: input.notes ?? null,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updateOwner(id: string, input: UpdateOwnerInput) {
  const current = await prisma.owner.findUnique({ where: { id } });
  if (!current) throw new FinanceDomainError("NOT_FOUND", "Собственник не найден");
  return prisma.owner.update({
    where: { id },
    data: {
      name: input.name,
      phone: input.phone === undefined ? undefined : input.phone,
      email: input.email === undefined ? undefined : input.email,
      notes: input.notes === undefined ? undefined : input.notes,
      isActive: input.isActive,
    },
  });
}

export async function getOwner(id: string) {
  const owner = await prisma.owner.findUnique({
    where: { id },
    include: {
      properties: {
        select: {
          id: true,
          name: true,
          managementType: true,
          city: true,
          status: true,
        },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!owner) throw new FinanceDomainError("NOT_FOUND", "Собственник не найден");
  return owner;
}

export async function listOwners() {
  return prisma.owner.findMany({
    include: { _count: { select: { properties: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

/** Soft-archive only. Hard delete forbidden when properties or finance history exist. */
export async function archiveOwner(id: string) {
  const owner = await prisma.owner.findUnique({
    where: { id },
    include: {
      _count: {
        select: { properties: true, payouts: true, financialTransactions: true },
      },
    },
  });
  if (!owner) throw new FinanceDomainError("NOT_FOUND", "Собственник не найден");
  return prisma.owner.update({ where: { id }, data: { isActive: false } });
}

export async function deleteOwnerHard(id: string): Promise<never> {
  const owner = await prisma.owner.findUnique({
    where: { id },
    include: {
      _count: {
        select: { properties: true, payouts: true, financialTransactions: true, settlements: true },
      },
    },
  });
  if (!owner) throw new FinanceDomainError("NOT_FOUND", "Собственник не найден");
  if (
    owner._count.properties > 0 ||
    owner._count.payouts > 0 ||
    owner._count.financialTransactions > 0 ||
    owner._count.settlements > 0
  ) {
    throw new FinanceDomainError(
      "FORBIDDEN",
      "Нельзя удалить собственника с объектами или финансовой историей. Деактивируйте его.",
    );
  }
  throw new FinanceDomainError("FORBIDDEN", "Hard delete собственника запрещён. Используйте isActive=false.");
}

export async function calculateShortTermOwnerShareOnPaid(
  ownerId: string,
  filters: OwnerFinanceQuery = {},
) {
  const properties = await prisma.property.findMany({
    where: { ownerId, managementType: "COMMISSION" },
    select: { id: true },
  });
  if (properties.length === 0) return 0;
  const propertyIds = properties.map((p) => p.id);

  const bookings = await prisma.booking.findMany({
    where: { propertyId: { in: propertyIds } },
    select: {
      id: true,
      commissionRateBps: true,
      property: { select: { managementType: true, commissionDaily: true } },
      payments: {
        include: { refunds: true },
      },
    },
  });

  let total = 0;
  for (const booking of bookings) {
    let paid = 0;
    let refunded = 0;
    for (const payment of booking.payments) {
      if (!inRange(payment.paidAt, filters.dateFrom, filters.dateTo)) continue;
      paid += payment.amount;
      // All refunds against in-range payments reduce net basis (history preserved).
      refunded += sumMoney(payment.refunds.map((r) => r.amount));
    }
    const net = paid - refunded;
    if (net <= 0) continue;

    const bps =
      booking.commissionRateBps ??
      (booking.property.commissionDaily == null
        ? 0
        : Math.round(booking.property.commissionDaily * 100));
    total += ownerShareFromNet(net, bps, booking.property.managementType).ownerShare;
  }
  return total;
}

export async function calculateLongTermOwnerShareOnPaid(
  ownerId: string,
  filters: OwnerFinanceQuery = {},
) {
  const properties = await prisma.property.findMany({
    where: { ownerId, managementType: "COMMISSION" },
    select: { id: true, managementType: true },
  });
  if (properties.length === 0) return 0;
  const propertyIds = properties.map((p) => p.id);

  const contracts = await prisma.longTermContract.findMany({
    where: { propertyId: { in: propertyIds } },
    select: {
      commissionRateBps: true,
      property: { select: { managementType: true } },
      payments: {
        include: {
          allocations: { include: { charge: { select: { type: true, status: true } } } },
        },
      },
    },
  });

  let total = 0;
  for (const contract of contracts) {
    let rentPaid = 0;
    for (const payment of contract.payments) {
      if (!inRange(payment.paidAt, filters.dateFrom, filters.dateTo)) continue;
      for (const alloc of payment.allocations) {
        if (alloc.charge.type !== "RENT") continue;
        if (alloc.charge.status === "CANCELLED") continue;
        rentPaid += alloc.amount;
      }
    }
    if (rentPaid <= 0) continue;
    total += ownerShareFromNet(
      rentPaid,
      contract.commissionRateBps,
      contract.property.managementType,
    ).ownerShare;
  }
  return total;
}

export async function calculateOwnerExpenses(ownerId: string, filters: OwnerFinanceQuery = {}) {
  const where: Prisma.FinancialTransactionWhereInput = {
    ownerId,
    type: "EXPENSE",
    expenseResponsibility: "OWNER",
  };
  if (filters.dateFrom || filters.dateTo) {
    where.occurredAt = {};
    if (filters.dateFrom) where.occurredAt.gte = dayStart(filters.dateFrom);
    if (filters.dateTo) where.occurredAt.lte = dayEnd(filters.dateTo);
  }
  const rows = await prisma.financialTransaction.findMany({
    where,
    select: { amount: true },
  });
  return sumMoney(rows.map((r) => r.amount));
}

export async function calculateOwnerPayouts(ownerId: string, filters: OwnerFinanceQuery = {}) {
  const where: Prisma.OwnerPayoutWhereInput = { ownerId };
  if (filters.dateFrom || filters.dateTo) {
    where.paidAt = {};
    if (filters.dateFrom) where.paidAt.gte = dayStart(filters.dateFrom);
    if (filters.dateTo) where.paidAt.lte = dayEnd(filters.dateTo);
  }
  const rows = await prisma.ownerPayout.findMany({ where, select: { amount: true } });
  return sumMoney(rows.map((r) => r.amount));
}

/** CREDIT increases payable to owner; DEBIT decreases. */
export async function calculateOwnerAdjustmentsNet(
  ownerId: string,
  filters: OwnerFinanceQuery = {},
) {
  const where: Prisma.FinancialTransactionWhereInput = {
    ownerId,
    type: "ADJUSTMENT",
  };
  if (filters.dateFrom || filters.dateTo) {
    where.occurredAt = {};
    if (filters.dateFrom) where.occurredAt.gte = dayStart(filters.dateFrom);
    if (filters.dateTo) where.occurredAt.lte = dayEnd(filters.dateTo);
  }
  const rows = await prisma.financialTransaction.findMany({
    where,
    select: { amount: true, adjustmentDirection: true },
  });
  let net = 0;
  for (const row of rows) {
    if (row.adjustmentDirection === "CREDIT") net += row.amount;
    else if (row.adjustmentDirection === "DEBIT") net -= row.amount;
  }
  return net;
}

export type OwnerBalance = {
  currency: "RUB";
  shortTermOwnerShareOnPaid: number;
  longTermOwnerShareOnPaid: number;
  ownerShareTotal: number;
  ownerExpenses: number;
  ownerPayouts: number;
  ownerAdjustmentsNet: number;
  balanceDue: number;
  exceedsWarning: boolean;
};

export async function calculateOwnerBalance(
  ownerId: string,
  filters: OwnerFinanceQuery = {},
): Promise<OwnerBalance> {
  const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
  if (!owner) throw new FinanceDomainError("NOT_FOUND", "Собственник не найден");

  const [
    shortTermOwnerShareOnPaid,
    longTermOwnerShareOnPaid,
    ownerExpenses,
    ownerPayouts,
    ownerAdjustmentsNet,
  ] = await Promise.all([
    calculateShortTermOwnerShareOnPaid(ownerId, filters),
    calculateLongTermOwnerShareOnPaid(ownerId, filters),
    calculateOwnerExpenses(ownerId, filters),
    calculateOwnerPayouts(ownerId, filters),
    calculateOwnerAdjustmentsNet(ownerId, filters),
  ]);

  const ownerShareTotal = shortTermOwnerShareOnPaid + longTermOwnerShareOnPaid;
  const balanceDue =
    ownerShareTotal - ownerExpenses - ownerPayouts + ownerAdjustmentsNet;

  return {
    currency: "RUB",
    shortTermOwnerShareOnPaid,
    longTermOwnerShareOnPaid,
    ownerShareTotal,
    ownerExpenses,
    ownerPayouts,
    ownerAdjustmentsNet,
    balanceDue,
    exceedsWarning: false,
  };
}

/** Accumulated balance as of end of dateTo (or now). */
export async function balanceAsOf(ownerId: string, asOfDate: string) {
  return calculateOwnerBalance(ownerId, { dateTo: asOfDate });
}

/** Activity strictly within [dateFrom, dateTo]. */
export async function periodActivity(ownerId: string, dateFrom: string, dateTo: string) {
  return calculateOwnerBalance(ownerId, { dateFrom, dateTo });
}

export async function syncOwnerPayoutTransaction(payoutId: string) {
  const payout = await prisma.ownerPayout.findUnique({
    where: { id: payoutId },
    include: {
      allocations: { take: 1, include: { property: { select: { id: true } } } },
    },
  });
  if (!payout) throw new FinanceDomainError("NOT_FOUND", "Выплата не найдена");

  const sourceKey = ownerPayoutSourceKey(payout.id);
  const existing = await prisma.financialTransaction.findUnique({ where: { sourceKey } });
  if (existing) return existing;

  const propertyId = payout.allocations[0]?.propertyId;
  if (!propertyId) {
    throw new FinanceDomainError("VALIDATION", "Выплата без allocation по объекту");
  }

  try {
    return await prisma.financialTransaction.create({
      data: {
        propertyId,
        ownerId: payout.ownerId,
        type: "OWNER_PAYOUT",
        category: "OWNER_PAYOUT",
        amount: payout.amount,
        currency: "RUB",
        occurredAt: payout.paidAt,
        description: payout.note ?? "Выплата собственнику",
        sourceType: "OWNER_SETTLEMENT",
        sourceId: payout.id,
        sourceKey,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new FinanceDomainError("CONFLICT", "Запись с таким sourceKey уже существует");
    }
    throw error;
  }
}

export async function createOwnerPayout(ownerId: string, input: CreateOwnerPayoutInput) {
  assertPositiveMoney(input.amount);
  const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
  if (!owner) throw new FinanceDomainError("NOT_FOUND", "Собственник не найден");
  if (!owner.isActive) {
    throw new FinanceDomainError("VALIDATION", "Собственник неактивен");
  }

  const allocTotal = sumMoney(input.allocations.map((a) => a.amount));
  if (allocTotal > input.amount) {
    throw new FinanceDomainError("VALIDATION", "Сумма allocation превышает выплату");
  }
  if (allocTotal <= 0) {
    throw new FinanceDomainError("VALIDATION", "Нужно распределение по объектам");
  }

  for (const alloc of input.allocations) {
    const property = await prisma.property.findUnique({
      where: { id: alloc.propertyId },
      select: { id: true, ownerId: true, managementType: true },
    });
    if (!property || property.ownerId !== ownerId) {
      throw new FinanceDomainError("VALIDATION", "Объект не принадлежит этому собственнику");
    }
    if (property.managementType !== "COMMISSION") {
      throw new FinanceDomainError("VALIDATION", "Выплата только по COMMISSION объектам");
    }
  }

  const balance = await calculateOwnerBalance(ownerId);
  const exceedsWarning = input.amount > balance.balanceDue;

  const payout = await prisma.ownerPayout.create({
    data: {
      ownerId,
      amount: input.amount,
      paidAt: input.paidAt,
      method: input.method ?? null,
      note: input.note ?? null,
      allocations: {
        create: input.allocations.map((a) => ({
          propertyId: a.propertyId,
          amount: a.amount,
        })),
      },
    },
    include: { allocations: true },
  });

  await syncOwnerPayoutTransaction(payout.id);

  return { payout, exceedsWarning, balanceDueBefore: balance.balanceDue };
}

export async function listOwnerPayouts(ownerId: string) {
  return prisma.ownerPayout.findMany({
    where: { ownerId },
    include: {
      allocations: {
        include: { property: { select: { id: true, name: true } } },
      },
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function createOwnerSettlement(ownerId: string, input: CreateOwnerSettlementInput) {
  const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
  if (!owner) throw new FinanceDomainError("NOT_FOUND", "Собственник не найден");
  return prisma.ownerSettlement.create({
    data: {
      ownerId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      notes: input.notes ?? null,
      status: "DRAFT",
    },
  });
}

export async function closeOwnerSettlement(settlementId: string) {
  const row = await prisma.ownerSettlement.findUnique({ where: { id: settlementId } });
  if (!row) throw new FinanceDomainError("NOT_FOUND", "Период расчёта не найден");
  if (row.status === "CLOSED") return row;
  return prisma.ownerSettlement.update({
    where: { id: settlementId },
    data: { status: "CLOSED", closedAt: new Date() },
  });
}

export async function listOwnerSettlements(ownerId: string) {
  return prisma.ownerSettlement.findMany({
    where: { ownerId },
    orderBy: [{ periodStart: "desc" }],
  });
}

export async function getOwnerFinanceBundle(ownerId: string, filters: OwnerFinanceQuery = {}) {
  const owner = await getOwner(ownerId);
  const balance = await calculateOwnerBalance(ownerId, filters);
  const payouts = await listOwnerPayouts(ownerId);
  const settlements = await listOwnerSettlements(ownerId);
  return { owner, balance, payouts, settlements };
}
