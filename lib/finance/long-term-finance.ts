/**
 * Long-term lease finance (Stage 12.3).
 * LongTermListing = marketing. LongTermContract = real lease.
 * Charge = accrued. Payment = cash. Allocation = payment→charge.
 * Commission/owner share = allocation metrics, not extra cash INCOME.
 */

import type {
  LongTermCharge,
  LongTermContract,
  ManagementType,
  Prisma,
} from "@prisma/client";
import {
  FinanceDomainError,
  applyCommissionBps,
  assertNonNegativeMoney,
  assertPositiveMoney,
  percentToBps,
  sumMoney,
} from "@/lib/finance/money";
import type {
  CreateLongTermContractInput,
  CreateManualChargeInput,
  GenerateChargesInput,
  RecordLongTermPaymentInput,
  UpdateLongTermContractInput,
} from "@/lib/finance/long-term-finance-validation";
import { prisma } from "@/lib/prisma";

const BPS_FULL = 10_000;

export function longTermRentChargeSourceKey(contractId: string, yearMonth: string) {
  return `LONG_TERM:${contractId}:RENT:${yearMonth}`;
}

export function longTermDepositChargeSourceKey(contractId: string) {
  return `LONG_TERM:${contractId}:DEPOSIT`;
}

export function longTermPaymentSourceKey(paymentId: string) {
  return `LONG_TERM_PAYMENT:${paymentId}`;
}

export function calculateRentCommission(input: {
  rentAmount: number;
  commissionRateBps: number;
  managementType: ManagementType;
}) {
  assertNonNegativeMoney(input.rentAmount);
  const isOperatorOwned = input.managementType === "OWN";
  const bps = isOperatorOwned ? BPS_FULL : input.commissionRateBps;
  const commissionAmount = applyCommissionBps(input.rentAmount, bps);
  const ownerShareAmount = isOperatorOwned ? 0 : input.rentAmount - commissionAmount;
  if (!isOperatorOwned && commissionAmount + ownerShareAmount !== input.rentAmount) {
    throw new FinanceDomainError("INTERNAL", "Нарушено тождество rent = commission + ownerShare");
  }
  return {
    commissionRateBps: bps,
    commissionAmount,
    ownerShareAmount,
    isOperatorOwned,
  };
}

function yearMonth(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function parseYearMonth(ym: string): { year: number; month: number } {
  const [ys, ms] = ym.split("-");
  return { year: Number(ys), month: Number(ms) };
}

function monthStartUtc(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
}

function monthEndUtc(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0, 12, 0, 0));
}

function dueDateForMonth(year: number, month: number, paymentDay: number) {
  return new Date(Date.UTC(year, month - 1, paymentDay, 12, 0, 0));
}

function addMonthsYm(ym: string, delta: number): string {
  const { year, month } = parseYearMonth(ym);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return yearMonth(d);
}

function compareYm(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

async function refreshChargeStatus(chargeId: string) {
  const charge = await prisma.longTermCharge.findUnique({
    where: { id: chargeId },
    include: { allocations: true },
  });
  if (!charge || charge.status === "CANCELLED") return charge;

  const paid = sumMoney(charge.allocations.map((a) => a.amount));
  let status: "OPEN" | "PARTIALLY_PAID" | "PAID" = "OPEN";
  if (paid <= 0) status = "OPEN";
  else if (paid >= charge.amount) status = "PAID";
  else status = "PARTIALLY_PAID";

  return prisma.longTermCharge.update({
    where: { id: chargeId },
    data: { status },
  });
}

function chargePaidAmount(charge: LongTermCharge & { allocations: { amount: number }[] }) {
  return sumMoney(charge.allocations.map((a) => a.amount));
}

function chargeOutstanding(charge: LongTermCharge & { allocations: { amount: number }[] }) {
  if (charge.status === "CANCELLED") return 0;
  return Math.max(0, charge.amount - chargePaidAmount(charge));
}

export async function createLongTermContract(input: CreateLongTermContractInput) {
  const property = await prisma.property.findUnique({
    where: { id: input.propertyId },
    select: {
      id: true,
      managementType: true,
      commissionMonthly: true,
      longTermListing: { select: { id: true } },
    },
  });
  if (!property) throw new FinanceDomainError("NOT_FOUND", "Объект не найден");

  const guest = await prisma.guest.findUnique({ where: { id: input.guestId }, select: { id: true } });
  if (!guest) throw new FinanceDomainError("NOT_FOUND", "Арендатор (гость) не найден");

  let listingId = input.longTermListingId ?? null;
  if (listingId) {
    const listing = await prisma.longTermListing.findUnique({
      where: { id: listingId },
      select: { id: true, propertyId: true },
    });
    if (!listing || listing.propertyId !== input.propertyId) {
      throw new FinanceDomainError("VALIDATION", "Объявление не соответствует объекту");
    }
  } else if (property.longTermListing) {
    listingId = property.longTermListing.id;
  }

  const status = input.status ?? "DRAFT";
  if (status === "ACTIVE") {
    const existingActive = await prisma.longTermContract.findFirst({
      where: { propertyId: input.propertyId, status: "ACTIVE" },
    });
    if (existingActive) {
      throw new FinanceDomainError("CONFLICT", "По объекту уже есть активный договор");
    }
  }

  const commissionRateBps =
    property.managementType === "OWN"
      ? BPS_FULL
      : property.commissionMonthly == null
        ? 0
        : percentToBps(property.commissionMonthly);

  const contract = await prisma.longTermContract.create({
    data: {
      propertyId: input.propertyId,
      longTermListingId: listingId,
      guestId: input.guestId,
      status,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      monthlyRent: input.monthlyRent,
      depositAmount: input.depositAmount,
      commissionRateBps,
      paymentDay: input.paymentDay,
      prorationMode: "MANUAL_FIRST_PERIOD",
      notes: input.notes ?? null,
    },
  });

  if (status === "ACTIVE" && contract.depositAmount > 0) {
    await ensureDepositCharge(contract);
  }

  return getLongTermContract(contract.id);
}

const contractInclude = {
  property: { select: { id: true, name: true, managementType: true, city: true } },
  guest: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleName: true,
      phone: true,
      email: true,
    },
  },
  longTermListing: { select: { id: true, monthlyPrice: true, deposit: true, status: true } },
} satisfies Prisma.LongTermContractInclude;

export async function updateLongTermContract(id: string, input: UpdateLongTermContractInput) {
  const current = await prisma.longTermContract.findUnique({ where: { id } });
  if (!current) throw new FinanceDomainError("NOT_FOUND", "Договор не найден");
  if (current.status !== "DRAFT") {
    throw new FinanceDomainError(
      "FORBIDDEN",
      "После активации условия меняются только через ограничения Stage 12.3 (LONG_TERM_RATE_CHANGE_LIMITATION)",
    );
  }

  if (input.guestId) {
    const guest = await prisma.guest.findUnique({ where: { id: input.guestId } });
    if (!guest) throw new FinanceDomainError("NOT_FOUND", "Арендатор не найден");
  }

  return prisma.longTermContract.update({
    where: { id },
    data: {
      guestId: input.guestId,
      startDate: input.startDate,
      endDate: input.endDate === undefined ? undefined : input.endDate,
      monthlyRent: input.monthlyRent,
      depositAmount: input.depositAmount,
      paymentDay: input.paymentDay,
      notes: input.notes === undefined ? undefined : input.notes,
    },
    include: contractInclude,
  });
}

export async function activateLongTermContract(id: string) {
  const current = await prisma.longTermContract.findUnique({ where: { id } });
  if (!current) throw new FinanceDomainError("NOT_FOUND", "Договор не найден");
  if (current.status === "ACTIVE") return getLongTermContract(id);
  if (current.status !== "DRAFT") {
    throw new FinanceDomainError("VALIDATION", "Активировать можно только DRAFT");
  }

  const existingActive = await prisma.longTermContract.findFirst({
    where: { propertyId: current.propertyId, status: "ACTIVE", NOT: { id } },
  });
  if (existingActive) {
    throw new FinanceDomainError("CONFLICT", "По объекту уже есть активный договор");
  }

  await prisma.longTermContract.update({
    where: { id },
    data: { status: "ACTIVE" },
  });

  // Seed deposit charge if deposit > 0
  if (current.depositAmount > 0) {
    await ensureDepositCharge(current);
  }

  return getLongTermContract(id);
}

async function ensureDepositCharge(contract: LongTermContract) {
  const sourceKey = longTermDepositChargeSourceKey(contract.id);
  const existing = await prisma.longTermCharge.findUnique({ where: { sourceKey } });
  if (existing) return existing;
  return prisma.longTermCharge.create({
    data: {
      contractId: contract.id,
      type: "DEPOSIT",
      dueDate: contract.startDate,
      amount: contract.depositAmount,
      sourceKey,
      description: "Обеспечительный депозит",
    },
  });
}

export async function endLongTermContract(id: string, endDate?: Date) {
  const current = await prisma.longTermContract.findUnique({ where: { id } });
  if (!current) throw new FinanceDomainError("NOT_FOUND", "Договор не найден");
  if (current.status !== "ACTIVE") {
    throw new FinanceDomainError("VALIDATION", "Завершить можно только ACTIVE");
  }

  await prisma.longTermContract.update({
    where: { id },
    data: {
      status: "ENDED",
      endDate: endDate ?? current.endDate ?? new Date(),
    },
  });

  await cancelFutureUnpaidCharges(id);
  return getLongTermContract(id);
}

export async function cancelLongTermContract(id: string) {
  const current = await prisma.longTermContract.findUnique({ where: { id } });
  if (!current) throw new FinanceDomainError("NOT_FOUND", "Договор не найден");
  if (current.status === "CANCELLED") return getLongTermContract(id);
  if (current.status === "ENDED") {
    throw new FinanceDomainError("VALIDATION", "Завершённый договор нельзя отменить");
  }

  await prisma.longTermContract.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  await cancelFutureUnpaidCharges(id);
  return getLongTermContract(id);
}

async function cancelFutureUnpaidCharges(contractId: string) {
  const charges = await prisma.longTermCharge.findMany({
    where: { contractId, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
    include: { allocations: true },
  });
  const today = new Date();
  for (const charge of charges) {
    if (charge.allocations.length > 0) continue;
    if (charge.dueDate >= today && charge.status === "OPEN") {
      await prisma.longTermCharge.update({
        where: { id: charge.id },
        data: { status: "CANCELLED" },
      });
    }
  }
}

/**
 * MANUAL_FIRST_PERIOD: skip auto RENT for start month if startDate day !== 1.
 * Generate calendar months from..to inclusive.
 */
export async function generateLongTermCharges(contractId: string, input: GenerateChargesInput = {}) {
  const contract = await prisma.longTermContract.findUnique({ where: { id: contractId } });
  if (!contract) throw new FinanceDomainError("NOT_FOUND", "Договор не найден");
  if (contract.status !== "ACTIVE" && contract.status !== "DRAFT") {
    throw new FinanceDomainError("VALIDATION", "Генерация начислений только для DRAFT/ACTIVE");
  }

  const created: string[] = [];
  const skipped: string[] = [];

  if (input.includeDeposit && contract.depositAmount > 0) {
    const dep = await ensureDepositCharge(contract);
    created.push(dep.id);
  }

  const startYm = yearMonth(contract.startDate);
  const now = new Date();
  const defaultFrom = startYm;
  const defaultTo = addMonthsYm(yearMonth(now), 1);

  const from = input.fromMonth ?? defaultFrom;
  const to = input.toMonth ?? defaultTo;
  if (compareYm(from, to) > 0) {
    throw new FinanceDomainError("VALIDATION", "fromMonth позже toMonth");
  }

  const startDay = contract.startDate.getUTCDate();

  for (let ym = from; compareYm(ym, to) <= 0; ym = addMonthsYm(ym, 1)) {
    if (contract.endDate && compareYm(ym, yearMonth(contract.endDate)) > 0) break;
    if (compareYm(ym, startYm) < 0) continue;

    // MANUAL_FIRST_PERIOD: incomplete first month not auto-generated
    if (
      contract.prorationMode === "MANUAL_FIRST_PERIOD" &&
      ym === startYm &&
      startDay !== 1
    ) {
      skipped.push(ym);
      continue;
    }

    const { year, month } = parseYearMonth(ym);
    const sourceKey = longTermRentChargeSourceKey(contractId, ym);
    const existing = await prisma.longTermCharge.findUnique({ where: { sourceKey } });
    if (existing) {
      skipped.push(ym);
      continue;
    }

    const row = await prisma.longTermCharge.create({
      data: {
        contractId,
        type: "RENT",
        periodStart: monthStartUtc(year, month),
        periodEnd: monthEndUtc(year, month),
        dueDate: dueDateForMonth(year, month, contract.paymentDay),
        amount: contract.monthlyRent,
        sourceKey,
        description: `Аренда ${ym}`,
      },
    });
    created.push(row.id);
  }

  return { createdCount: created.length, skippedMonths: skipped, createdIds: created };
}

export async function createManualCharge(contractId: string, input: CreateManualChargeInput) {
  const contract = await prisma.longTermContract.findUnique({ where: { id: contractId } });
  if (!contract) throw new FinanceDomainError("NOT_FOUND", "Договор не найден");

  const stamp = Date.now();
  const sourceKey =
    input.type === "DEPOSIT"
      ? longTermDepositChargeSourceKey(contractId)
      : `LONG_TERM:${contractId}:${input.type}:MANUAL:${stamp}`;

  if (input.type === "DEPOSIT") {
    const existing = await prisma.longTermCharge.findUnique({ where: { sourceKey } });
    if (existing) throw new FinanceDomainError("CONFLICT", "Депозитное начисление уже есть");
  }

  return prisma.longTermCharge.create({
    data: {
      contractId,
      type: input.type,
      amount: input.amount,
      dueDate: input.dueDate,
      periodStart: input.periodStart ?? null,
      periodEnd: input.periodEnd ?? null,
      sourceKey,
      description: input.description,
    },
  });
}

export async function syncLongTermPaymentTransaction(paymentId: string) {
  const payment = await prisma.longTermPayment.findUnique({
    where: { id: paymentId },
    include: {
      contract: {
        select: {
          id: true,
          propertyId: true,
          longTermListingId: true,
          property: { select: { managementType: true, rentCollectionMode: true } },
        },
      },
      allocations: { include: { charge: { select: { type: true } } } },
    },
  });
  if (!payment) throw new FinanceDomainError("NOT_FOUND", "Платёж не найден");

  const depositAllocated = sumMoney(
    payment.allocations.filter((a) => a.charge.type === "DEPOSIT").map((a) => a.amount),
  );
  const allDeposit =
    payment.allocations.length > 0 && depositAllocated === payment.amount;

  const { managementType, rentCollectionMode } = payment.contract.property;

  if (
    !allDeposit &&
    managementType === "COMMISSION" &&
    rentCollectionMode === "OWNER_DIRECT"
  ) {
    return null;
  }

  const sourceKey = longTermPaymentSourceKey(payment.id);
  const existing = await prisma.financialTransaction.findUnique({ where: { sourceKey } });
  if (existing) return existing;

  const economicRole = allDeposit
    ? ("NEUTRAL" as const)
    : managementType === "OWN"
      ? ("BUSINESS_REVENUE" as const)
      : ("PASS_THROUGH" as const);

  try {
    return await prisma.financialTransaction.create({
      data: {
        propertyId: payment.contract.propertyId,
        longTermListingId: payment.contract.longTermListingId,
        longTermContractId: payment.contract.id,
        type: "INCOME",
        category: allDeposit ? "SECURITY_DEPOSIT_RECEIVED" : "RENT_PAYMENT",
        economicRole,
        amount: payment.amount,
        currency: "RUB",
        occurredAt: payment.paidAt,
        description: payment.note ?? "Оплата по договору долгосрочной аренды",
        sourceType: "LONG_TERM",
        sourceId: payment.id,
        sourceKey,
      },
    });
  } catch (error) {
    const { Prisma } = await import("@prisma/client");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new FinanceDomainError("CONFLICT", "Запись с таким sourceKey уже существует");
    }
    throw error;
  }
}

export async function recordLongTermPayment(
  contractId: string,
  input: RecordLongTermPaymentInput,
) {
  assertPositiveMoney(input.amount);
  const contract = await prisma.longTermContract.findUnique({ where: { id: contractId } });
  if (!contract) throw new FinanceDomainError("NOT_FOUND", "Договор не найден");
  if (contract.status === "CANCELLED") {
    throw new FinanceDomainError("VALIDATION", "Нельзя принимать оплату по отменённому договору");
  }

  const payment = await prisma.longTermPayment.create({
    data: {
      contractId,
      amount: input.amount,
      paidAt: input.paidAt,
      method: input.method ?? null,
      note: input.note ?? null,
    },
  });

  if (input.allocations && input.allocations.length > 0) {
    await applyExplicitAllocations(payment.id, input.amount, input.allocations);
  } else {
    await autoAllocatePayment(payment.id, contractId, input.amount);
  }

  await syncLongTermPaymentTransaction(payment.id);
  return payment;
}

async function applyExplicitAllocations(
  paymentId: string,
  paymentAmount: number,
  allocations: Array<{ chargeId: string; amount: number }>,
) {
  const total = sumMoney(allocations.map((a) => a.amount));
  if (total > paymentAmount) {
    throw new FinanceDomainError("VALIDATION", "Сумма allocation превышает платёж");
  }

  for (const alloc of allocations) {
    assertPositiveMoney(alloc.amount);
    const charge = await prisma.longTermCharge.findUnique({
      where: { id: alloc.chargeId },
      include: { allocations: true },
    });
    if (!charge || charge.status === "CANCELLED") {
      throw new FinanceDomainError("VALIDATION", "Начисление недоступно для allocation");
    }
    const outstanding = chargeOutstanding(charge);
    if (alloc.amount > outstanding) {
      throw new FinanceDomainError("VALIDATION", "Allocation превышает остаток начисления");
    }
    await prisma.longTermPaymentAllocation.create({
      data: { paymentId, chargeId: alloc.chargeId, amount: alloc.amount },
    });
    await refreshChargeStatus(alloc.chargeId);
  }
}

async function autoAllocatePayment(paymentId: string, contractId: string, amount: number) {
  let remaining = amount;
  const charges = await prisma.longTermCharge.findMany({
    where: { contractId, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
    include: { allocations: true },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });

  for (const charge of charges) {
    if (remaining <= 0) break;
    const outstanding = chargeOutstanding(charge);
    if (outstanding <= 0) continue;
    const apply = Math.min(remaining, outstanding);
    await prisma.longTermPaymentAllocation.create({
      data: { paymentId, chargeId: charge.id, amount: apply },
    });
    await refreshChargeStatus(charge.id);
    remaining -= apply;
  }
  // leftover = overpayment (unallocated) — preserved on payment amount
}

export async function getLongTermContract(id: string) {
  const row = await prisma.longTermContract.findUnique({
    where: { id },
    include: contractInclude,
  });
  if (!row) throw new FinanceDomainError("NOT_FOUND", "Договор не найден");
  return row;
}

export async function listLongTermContracts(filters?: { status?: string; propertyId?: string }) {
  return prisma.longTermContract.findMany({
    where: {
      status: filters?.status as LongTermContract["status"] | undefined,
      propertyId: filters?.propertyId,
    },
    include: contractInclude,
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });
}

export type ContractFinanceSummary = {
  currency: "RUB";
  rentAccrued: number;
  rentPaid: number;
  rentOutstanding: number;
  depositAccrued: number;
  depositPaid: number;
  commissionAccrued: number;
  commissionOnPaid: number;
  ownerShareAccrued: number;
  ownerShareOnPaid: number;
  unallocatedPaymentAmount: number;
  nextDueDate: string | null;
  overdueChargeCount: number;
};

export async function getContractFinanceSummary(contractId: string): Promise<{
  contract: Awaited<ReturnType<typeof getLongTermContract>>;
  summary: ContractFinanceSummary;
  charges: Array<{
    id: string;
    type: string;
    amount: number;
    paid: number;
    outstanding: number;
    status: string;
    dueDate: string;
    periodStart: string | null;
    periodEnd: string | null;
    description: string | null;
    overdue: boolean;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    paidAt: string;
    method: string | null;
    note: string | null;
    allocations: Array<{ chargeId: string; amount: number; chargeType: string }>;
  }>;
}> {
  const contract = await getLongTermContract(contractId);
  const charges = await prisma.longTermCharge.findMany({
    where: { contractId },
    include: { allocations: true },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });
  const payments = await prisma.longTermPayment.findMany({
    where: { contractId },
    include: {
      allocations: { include: { charge: { select: { id: true, type: true } } } },
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let rentAccrued = 0;
  let rentPaid = 0;
  let depositAccrued = 0;
  let depositPaid = 0;

  const chargeViews = charges.map((c) => {
    const paid = chargePaidAmount(c);
    const outstanding = chargeOutstanding(c);
    if (c.type === "RENT" && c.status !== "CANCELLED") {
      rentAccrued += c.amount;
      rentPaid += paid;
    }
    if (c.type === "DEPOSIT" && c.status !== "CANCELLED") {
      depositAccrued += c.amount;
      depositPaid += paid;
    }
    const overdue =
      c.status !== "CANCELLED" && c.status !== "PAID" && c.dueDate < today && outstanding > 0;
    return {
      id: c.id,
      type: c.type,
      amount: c.amount,
      paid,
      outstanding,
      status: c.status,
      dueDate: c.dueDate.toISOString(),
      periodStart: c.periodStart?.toISOString() ?? null,
      periodEnd: c.periodEnd?.toISOString() ?? null,
      description: c.description,
      overdue,
    };
  });

  const splitAccrued = calculateRentCommission({
    rentAmount: rentAccrued,
    commissionRateBps: contract.commissionRateBps,
    managementType: contract.property.managementType,
  });
  const splitPaid = calculateRentCommission({
    rentAmount: rentPaid,
    commissionRateBps: contract.commissionRateBps,
    managementType: contract.property.managementType,
  });

  const allocatedTotal = sumMoney(
    payments.flatMap((p) => p.allocations.map((a) => a.amount)),
  );
  const paidTotal = sumMoney(payments.map((p) => p.amount));

  const nextOpen = chargeViews.find((c) => c.outstanding > 0 && !c.overdue) ??
    chargeViews.find((c) => c.outstanding > 0);

  return {
    contract,
    summary: {
      currency: "RUB",
      rentAccrued,
      rentPaid,
      rentOutstanding: rentAccrued - rentPaid,
      depositAccrued,
      depositPaid,
      commissionAccrued: splitAccrued.commissionAmount,
      commissionOnPaid: splitPaid.commissionAmount,
      ownerShareAccrued: splitAccrued.ownerShareAmount,
      ownerShareOnPaid: splitPaid.ownerShareAmount,
      unallocatedPaymentAmount: paidTotal - allocatedTotal,
      nextDueDate: nextOpen?.dueDate ?? null,
      overdueChargeCount: chargeViews.filter((c) => c.overdue).length,
    },
    charges: chargeViews,
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      paidAt: p.paidAt.toISOString(),
      method: p.method,
      note: p.note,
      allocations: p.allocations.map((a) => ({
        chargeId: a.chargeId,
        amount: a.amount,
        chargeType: a.charge.type,
      })),
    })),
  };
}
