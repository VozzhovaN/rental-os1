import type {
  EconomicRole,
  FinancialTransaction,
  FinancialTransactionType,
  FinancialCategory,
  Prisma,
} from "@prisma/client";
import { Prisma as PrismaNamespace } from "@prisma/client";
import { calculateBusinessEconomics } from "@/lib/finance/property-economics";
import { FinanceDomainError, assertPositiveMoney, sumMoney } from "@/lib/finance/money";
import { signedCashContribution } from "@/lib/finance/types";
import { prisma } from "@/lib/prisma";
import type {
  CreateAdjustmentInput,
  CreateExpenseServiceInput,
  ListFinanceQuery,
} from "@/lib/finance/validation";

export type FinanceSummary = {
  currency: "RUB";
  incomeTotal: number;
  expenseTotal: number;
  ownerPayoutTotal: number;
  adjustmentNet: number;
  netCashMovement: number;
  /** Stage 12.4 unit economics KPIs */
  businessRevenue: number;
  totalOperatorExpenses: number;
  netProfit: number;
  grossRent: number;
  commissionReceived: number;
  commissionAccrued: number;
};

export type SerializedFinancialTransaction = {
  id: string;
  propertyId: string | null;
  propertyName: string | null;
  bookingId: string | null;
  longTermListingId: string | null;
  longTermContractId: string | null;
  ownerId: string | null;
  type: FinancialTransactionType;
  category: FinancialCategory;
  amount: number;
  currency: "RUB";
  adjustmentDirection: "CREDIT" | "DEBIT" | null;
  expenseResponsibility: "OPERATOR" | "OWNER" | null;
  economicRole: EconomicRole | null;
  signedAmount: number;
  occurredAt: string;
  description: string | null;
  sourceType: string;
  sourceId: string | null;
  sourceKey: string | null;
  createdAt: string;
};

function dayStart(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function dayEnd(isoDate: string) {
  return new Date(`${isoDate}T23:59:59.999Z`);
}

function buildWhere(filters: ListFinanceQuery): Prisma.FinancialTransactionWhereInput {
  const where: Prisma.FinancialTransactionWhereInput = {};
  if (filters.propertyId) where.propertyId = filters.propertyId;
  if (filters.type) where.type = filters.type;
  if (filters.category) where.category = filters.category;
  if (filters.dateFrom || filters.dateTo) {
    where.occurredAt = {};
    if (filters.dateFrom) where.occurredAt.gte = dayStart(filters.dateFrom);
    if (filters.dateTo) where.occurredAt.lte = dayEnd(filters.dateTo);
  }
  return where;
}

export function serializeFinancialTransaction(
  row: FinancialTransaction & { property: { name: string } | null },
): SerializedFinancialTransaction {
  const signedAmount = signedCashContribution({
    type: row.type,
    amount: row.amount,
    adjustmentDirection: row.adjustmentDirection,
  });
  return {
    id: row.id,
    propertyId: row.propertyId,
    propertyName: row.property?.name ?? null,
    bookingId: row.bookingId,
    longTermListingId: row.longTermListingId,
    longTermContractId: row.longTermContractId,
    ownerId: row.ownerId,
    type: row.type,
    category: row.category,
    amount: row.amount,
    currency: "RUB",
    adjustmentDirection: row.adjustmentDirection,
    expenseResponsibility: row.expenseResponsibility,
    economicRole: row.economicRole,
    signedAmount,
    occurredAt: row.occurredAt.toISOString(),
    description: row.description,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    sourceKey: row.sourceKey,
    createdAt: row.createdAt.toISOString(),
  };
}

async function assertPropertyExists(propertyId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });
  if (!property) {
    throw new FinanceDomainError("NOT_FOUND", "Объект не найден");
  }
}

/**
 * Create ledger entry with optional idempotent sourceKey.
 * Duplicate sourceKey → CONFLICT (no second row).
 */
export async function createFinancialTransaction(input: {
  propertyId?: string | null;
  bookingId?: string | null;
  longTermListingId?: string | null;
  longTermContractId?: string | null;
  ownerId?: string | null;
  type: FinancialTransactionType;
  category: FinancialCategory;
  amount: number;
  adjustmentDirection?: "CREDIT" | "DEBIT" | null;
  expenseResponsibility?: "OPERATOR" | "OWNER" | null;
  economicRole?: EconomicRole | null;
  occurredAt: Date;
  description?: string | null;
  sourceType:
    | "MANUAL"
    | "BOOKING"
    | "LONG_TERM"
    | "OWNER_SETTLEMENT"
    | "COMMISSION_PAYMENT"
    | "SYSTEM_ADJUSTMENT";
  sourceId?: string | null;
  sourceKey?: string | null;
}) {
  assertPositiveMoney(input.amount);

  if (input.type === "ADJUSTMENT" && !input.adjustmentDirection) {
    throw new FinanceDomainError("VALIDATION", "Для корректировки укажите направление");
  }
  if (input.type !== "ADJUSTMENT" && input.adjustmentDirection) {
    throw new FinanceDomainError("VALIDATION", "Направление допустимо только для корректировки");
  }

  if (input.propertyId) {
    await assertPropertyExists(input.propertyId);
  }

  try {
    return await prisma.financialTransaction.create({
      data: {
        propertyId: input.propertyId ?? null,
        bookingId: input.bookingId ?? null,
        longTermListingId: input.longTermListingId ?? null,
        longTermContractId: input.longTermContractId ?? null,
        ownerId: input.ownerId ?? null,
        type: input.type,
        category: input.category,
        amount: input.amount,
        currency: "RUB",
        adjustmentDirection: input.adjustmentDirection ?? null,
        expenseResponsibility: input.expenseResponsibility ?? null,
        economicRole: input.economicRole ?? null,
        occurredAt: input.occurredAt,
        description: input.description ?? null,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        sourceKey: input.sourceKey ?? null,
      },
      include: { property: { select: { name: true } } },
    });
  } catch (error) {
    if (error instanceof PrismaNamespace.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new FinanceDomainError("CONFLICT", "Запись с таким sourceKey уже существует");
    }
    throw error;
  }
}

export async function createManualExpense(input: CreateExpenseServiceInput) {
  if (input.propertyId) {
    const property = await prisma.property.findUnique({
      where: { id: input.propertyId },
      select: { id: true, managementType: true, ownerId: true },
    });
    if (!property) {
      throw new FinanceDomainError("NOT_FOUND", "Объект не найден");
    }

    const responsibility = input.expenseResponsibility ?? "OPERATOR";
    if (responsibility === "OWNER") {
      if (property.managementType !== "COMMISSION" || !property.ownerId) {
        throw new FinanceDomainError(
          "VALIDATION",
          "Расход за счёт собственника только для COMMISSION объекта с Owner",
        );
      }
    }

    return createFinancialTransaction({
      propertyId: input.propertyId,
      ownerId: responsibility === "OWNER" ? property.ownerId : null,
      type: "EXPENSE",
      category: input.category,
      amount: input.amount,
      expenseResponsibility: responsibility,
      economicRole: responsibility === "OPERATOR" ? "BUSINESS_EXPENSE" : null,
      occurredAt: input.occurredAt,
      description: input.description,
      sourceType: "MANUAL",
    });
  }

  return createFinancialTransaction({
    propertyId: null,
    type: "EXPENSE",
    category: input.category,
    amount: input.amount,
    expenseResponsibility: "OPERATOR",
    economicRole: "BUSINESS_EXPENSE",
    occurredAt: input.occurredAt,
    description: input.description,
    sourceType: "MANUAL",
  });
}

export async function createManualAdjustment(input: CreateAdjustmentInput) {
  const ownerId: string | null = input.ownerId ?? null;
  if (ownerId) {
    const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
    if (!owner) throw new FinanceDomainError("NOT_FOUND", "Собственник не найден");
  }

  return createFinancialTransaction({
    propertyId: input.propertyId,
    ownerId,
    type: "ADJUSTMENT",
    category: "ADJUSTMENT",
    amount: input.amount,
    adjustmentDirection: input.direction,
    occurredAt: input.occurredAt,
    description: input.description,
    sourceType: "SYSTEM_ADJUSTMENT",
  });
}

export async function listFinancialTransactions(filters: ListFinanceQuery = {}) {
  const rows = await prisma.financialTransaction.findMany({
    where: buildWhere(filters),
    include: { property: { select: { name: true } } },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
  return rows.map(serializeFinancialTransaction);
}

export async function getFinanceSummary(filters: ListFinanceQuery = {}): Promise<FinanceSummary> {
  const rows = await prisma.financialTransaction.findMany({
    where: buildWhere(filters),
    select: {
      type: true,
      amount: true,
      adjustmentDirection: true,
    },
  });

  const income: number[] = [];
  const expense: number[] = [];
  const ownerPayout: number[] = [];
  const adjustmentNetParts: number[] = [];

  for (const row of rows) {
    const signed = signedCashContribution({
      type: row.type,
      amount: row.amount,
      adjustmentDirection: row.adjustmentDirection,
    });
    if (row.type === "INCOME") income.push(row.amount);
    if (row.type === "EXPENSE") expense.push(row.amount);
    if (row.type === "OWNER_PAYOUT") ownerPayout.push(row.amount);
    if (row.type === "ADJUSTMENT") adjustmentNetParts.push(signed);
  }

  const incomeTotal = sumMoney(income);
  const expenseTotal = sumMoney(expense);
  const ownerPayoutTotal = sumMoney(ownerPayout);
  const adjustmentNet = sumMoney(adjustmentNetParts);
  const netCashMovement = incomeTotal - expenseTotal - ownerPayoutTotal + adjustmentNet;

  const economics = await calculateBusinessEconomics({
    propertyId: filters.propertyId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });

  return {
    currency: "RUB",
    incomeTotal,
    expenseTotal,
    ownerPayoutTotal,
    adjustmentNet,
    netCashMovement,
    businessRevenue: economics.businessRevenue,
    totalOperatorExpenses: economics.totalOperatorExpenses,
    netProfit: economics.netProfit,
    grossRent: economics.grossRent,
    commissionReceived: economics.commissionReceived,
    commissionAccrued: economics.commissionAccrued,
  };
}

/** Hard delete is forbidden for posted ledger entries. */
export async function deleteFinancialTransaction(_id: string): Promise<never> {
  throw new FinanceDomainError(
    "FORBIDDEN",
    "Удаление финансовых записей запрещено. Используйте корректировку.",
  );
}
