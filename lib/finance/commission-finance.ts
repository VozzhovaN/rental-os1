/**
 * Commission cash received from property owners (Stage 12.4).
 * Distinct from guest rent (BookingPayment / LongTermPayment).
 */

import type { Prisma } from "@prisma/client";
import {
  FinanceDomainError,
  applyCommissionBps,
  assertPositiveMoney,
  percentToBps,
  sumMoney,
} from "@/lib/finance/money";
import { commissionPaymentSourceKey } from "@/lib/finance/types";
import { createFinancialTransaction } from "@/lib/finance/service";
import type { CreateCommissionPaymentInput } from "@/lib/finance/commission-finance-validation";
import { calculateBookingFinancialBreakdown } from "@/lib/finance/booking-finance";
import { calculateRentCommission } from "@/lib/finance/long-term-finance";
import { prisma } from "@/lib/prisma";

function dayStart(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function dayEnd(isoDate: string) {
  return new Date(`${isoDate}T23:59:59.999Z`);
}

export async function syncCommissionPaymentTransaction(paymentId: string) {
  const payment = await prisma.commissionPayment.findUnique({
    where: { id: paymentId },
    include: {
      property: { select: { managementType: true } },
    },
  });
  if (!payment) {
    throw new FinanceDomainError("NOT_FOUND", "Платёж комиссии не найден");
  }
  if (payment.property.managementType !== "COMMISSION") {
    throw new FinanceDomainError(
      "VALIDATION",
      "Платёж комиссии допустим только для COMMISSION объектов",
    );
  }

  const sourceKey = commissionPaymentSourceKey(payment.id);
  const existing = await prisma.financialTransaction.findUnique({ where: { sourceKey } });
  if (existing) return existing;

  return createFinancialTransaction({
    propertyId: payment.propertyId,
    bookingId: payment.bookingId,
    longTermContractId: payment.longTermContractId,
    type: "INCOME",
    category: "OPERATOR_COMMISSION",
    economicRole: "BUSINESS_REVENUE",
    amount: payment.amount,
    occurredAt: payment.paidAt,
    description: payment.note ?? "Комиссия от собственника",
    sourceType: "COMMISSION_PAYMENT",
    sourceId: payment.id,
    sourceKey,
  });
}

export async function createCommissionPayment(input: CreateCommissionPaymentInput) {
  assertPositiveMoney(input.amount);

  const property = await prisma.property.findUnique({
    where: { id: input.propertyId },
    select: { id: true, managementType: true },
  });
  if (!property) {
    throw new FinanceDomainError("NOT_FOUND", "Объект не найден");
  }
  if (property.managementType !== "COMMISSION") {
    throw new FinanceDomainError(
      "VALIDATION",
      "Платёж комиссии допустим только для COMMISSION объектов",
    );
  }

  if (input.bookingId) {
    const booking = await prisma.booking.findFirst({
      where: { id: input.bookingId, propertyId: input.propertyId },
    });
    if (!booking) {
      throw new FinanceDomainError("NOT_FOUND", "Бронирование не найдено для объекта");
    }
  } else if (input.longTermContractId) {
    const contract = await prisma.longTermContract.findFirst({
      where: { id: input.longTermContractId, propertyId: input.propertyId },
    });
    if (!contract) {
      throw new FinanceDomainError("NOT_FOUND", "Договор не найден для объекта");
    }
  }

  const payment = await prisma.commissionPayment.create({
    data: {
      propertyId: input.propertyId,
      bookingId: input.bookingId ?? null,
      longTermContractId: input.longTermContractId ?? null,
      amount: input.amount,
      paidAt: input.paidAt,
      method: input.method ?? null,
      note: input.note ?? null,
      sourceKey: null,
    },
  });

  await prisma.commissionPayment.update({
    where: { id: payment.id },
    data: { sourceKey: commissionPaymentSourceKey(payment.id) },
  });

  await syncCommissionPaymentTransaction(payment.id);
  return prisma.commissionPayment.findUniqueOrThrow({ where: { id: payment.id } });
}

export async function listCommissionPayments(filters: {
  propertyId?: string;
  bookingId?: string;
  longTermContractId?: string;
  dateFrom?: string;
  dateTo?: string;
} = {}) {
  const where: Prisma.CommissionPaymentWhereInput = {};
  if (filters.propertyId) where.propertyId = filters.propertyId;
  if (filters.bookingId) where.bookingId = filters.bookingId;
  if (filters.longTermContractId) where.longTermContractId = filters.longTermContractId;
  if (filters.dateFrom || filters.dateTo) {
    where.paidAt = {};
    if (filters.dateFrom) where.paidAt.gte = dayStart(filters.dateFrom);
    if (filters.dateTo) where.paidAt.lte = dayEnd(filters.dateTo);
  }

  return prisma.commissionPayment.findMany({
    where,
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function calculateBookingCommissionAccrued(
  bookingId: string,
  filters?: { dateFrom?: string; dateTo?: string },
): Promise<number> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      property: { select: { managementType: true, commissionDaily: true } },
      payments: {
        include: { refunds: true },
        ...(filters?.dateFrom || filters?.dateTo
          ? {
              where: {
                paidAt: {
                  ...(filters.dateFrom ? { gte: dayStart(filters.dateFrom) } : {}),
                  ...(filters.dateTo ? { lte: dayEnd(filters.dateTo) } : {}),
                },
              },
            }
          : {}),
      },
    },
  });
  if (!booking) throw new FinanceDomainError("NOT_FOUND", "Бронирование не найдено");
  if (booking.property.managementType !== "COMMISSION") return 0;

  const bps =
    booking.commissionRateBps ??
    (booking.property.commissionDaily != null
      ? percentToBps(booking.property.commissionDaily)
      : 0);

  const paid = sumMoney(booking.payments.map((p) => p.amount));
  const refunded = sumMoney(booking.payments.flatMap((p) => p.refunds.map((r) => r.amount)));
  const netPaid = paid - refunded;
  if (netPaid <= 0) return 0;

  return applyCommissionBps(netPaid, bps);
}

export async function calculateLongTermCommissionAccrued(
  contractId: string,
  filters?: { dateFrom?: string; dateTo?: string },
): Promise<number> {
  const contract = await prisma.longTermContract.findUnique({
    where: { id: contractId },
    include: {
      property: { select: { managementType: true } },
      payments: {
        include: {
          allocations: { include: { charge: { select: { type: true } } } },
        },
        ...(filters?.dateFrom || filters?.dateTo
          ? {
              where: {
                paidAt: {
                  ...(filters.dateFrom ? { gte: dayStart(filters.dateFrom) } : {}),
                  ...(filters.dateTo ? { lte: dayEnd(filters.dateTo) } : {}),
                },
              },
            }
          : {}),
      },
    },
  });
  if (!contract) throw new FinanceDomainError("NOT_FOUND", "Договор не найден");
  if (contract.property.managementType !== "COMMISSION") return 0;

  let rentPaid = 0;
  for (const payment of contract.payments) {
    rentPaid += sumMoney(
      payment.allocations.filter((a) => a.charge.type === "RENT").map((a) => a.amount),
    );
  }

  const split = calculateRentCommission({
    rentAmount: rentPaid,
    commissionRateBps: contract.commissionRateBps,
    managementType: contract.property.managementType,
  });
  return split.commissionAmount;
}

export async function calculateCommissionReceived(filters: {
  propertyId?: string;
  bookingId?: string;
  longTermContractId?: string;
  dateFrom?: string;
  dateTo?: string;
} = {}): Promise<number> {
  const rows = await listCommissionPayments(filters);
  return sumMoney(rows.map((r) => r.amount));
}

export function calculateCommissionReceivable(accrued: number, received: number) {
  return Math.max(accrued - received, 0);
}

export function calculateCommissionOverpayment(accrued: number, received: number) {
  return Math.max(received - accrued, 0);
}

export async function getBookingCommissionSummary(
  bookingId: string,
  filters?: { dateFrom?: string; dateTo?: string },
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { property: { select: { managementType: true, commissionDaily: true } } },
  });
  if (!booking) throw new FinanceDomainError("NOT_FOUND", "Бронирование не найдено");

  const payments = await prisma.bookingPayment.findMany({
    where: {
      bookingId,
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

  const bps =
    booking.commissionRateBps ??
    (booking.property.commissionDaily != null
      ? percentToBps(booking.property.commissionDaily)
      : 0);

  const breakdown = calculateBookingFinancialBreakdown({
    grossAmount: booking.totalAmount,
    commissionRateBps: bps,
    managementType: booking.property.managementType,
  });

  const accrued = await calculateBookingCommissionAccrued(bookingId, filters);
  const received = await calculateCommissionReceived({ bookingId, ...filters });

  return {
    currency: "RUB" as const,
    managementType: booking.property.managementType,
    netPaidAmount: netPaid,
    ownRentalRevenue: booking.property.managementType === "OWN" ? netPaid : 0,
    commissionAccrued: accrued,
    commissionReceived: received,
    commissionReceivable: calculateCommissionReceivable(accrued, received),
    commissionOverpayment: calculateCommissionOverpayment(accrued, received),
    breakdown,
  };
}

export async function getLongTermCommissionSummary(
  contractId: string,
  filters?: { dateFrom?: string; dateTo?: string },
) {
  const accrued = await calculateLongTermCommissionAccrued(contractId, filters);
  const received = await calculateCommissionReceived({ longTermContractId: contractId, ...filters });
  const contract = await prisma.longTermContract.findUniqueOrThrow({
    where: { id: contractId },
    include: { property: { select: { managementType: true } } },
  });

  return {
    currency: "RUB" as const,
    managementType: contract.property.managementType,
    commissionAccrued: accrued,
    commissionReceived: received,
    commissionReceivable: calculateCommissionReceivable(accrued, received),
    commissionOverpayment: calculateCommissionOverpayment(accrued, received),
  };
}
