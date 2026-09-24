/**
 * Short-term booking finance (Stage 12.2).
 *
 * Cash flow vs allocation:
 * - BookingPayment → ledger INCOME / RENT_PAYMENT (once per payment)
 * - commission / owner share → calculated breakdown only (never extra cash INCOME)
 * - BookingPaymentRefund → ledger EXPENSE / GUEST_REFUND
 */

import type { ManagementType } from "@prisma/client";
import {
  FinanceDomainError,
  applyCommissionBps,
  assertNonNegativeMoney,
  assertPositiveMoney,
  percentToBps,
  sumMoney,
} from "@/lib/finance/money";
import {
  bookingPaymentRefundSourceKey,
  bookingPaymentRentSourceKey,
} from "@/lib/finance/types";
import { createFinancialTransaction } from "@/lib/finance/service";
import type {
  RecordBookingPaymentInput,
  RecordBookingRefundInput,
} from "@/lib/finance/booking-finance-validation";
import { prisma } from "@/lib/prisma";

const BPS_FULL = 10_000;

export type BookingFinancialBreakdown = {
  currency: "RUB";
  grossAmount: number;
  commissionRateBps: number;
  commissionRatePercent: number;
  commissionAmount: number;
  ownerShareAmount: number;
  managementType: ManagementType;
  /** True when Property is OWN — no external owner debt. */
  isOperatorOwned: boolean;
};

export type BookingPaymentView = {
  id: string;
  amount: number;
  paidAt: string;
  method: string | null;
  note: string | null;
  refundedAmount: number;
  netAmount: number;
  createdAt: string;
  refunds: Array<{
    id: string;
    amount: number;
    refundedAt: string;
    note: string | null;
  }>;
};

export type BookingFinanceState = {
  bookingId: string;
  status: string;
  breakdown: BookingFinancialBreakdown;
  paidAmount: number;
  refundedAmount: number;
  netPaidAmount: number;
  remainingAmount: number;
  overpaymentAmount: number;
  /** Allocation on full gross (accrued). */
  commissionAccrued: number;
  ownerShareAccrued: number;
  /** Allocation proportional to net cash received (integer half-up on received). */
  commissionOnReceived: number;
  ownerShareOnReceived: number;
  payments: BookingPaymentView[];
};

function commissionRatePercentFromBps(bps: number): number {
  return bps / 100;
}

/**
 * Pure deterministic split. Does not touch DB.
 * Identity: grossAmount === commissionAmount + ownerShareAmount.
 */
export function calculateBookingFinancialBreakdown(input: {
  grossAmount: number;
  commissionRateBps: number;
  managementType: ManagementType;
}): BookingFinancialBreakdown {
  assertNonNegativeMoney(input.grossAmount);
  const isOperatorOwned = input.managementType === "OWN";
  const bps = isOperatorOwned ? BPS_FULL : input.commissionRateBps;
  if (!Number.isInteger(bps) || bps < 0 || bps > BPS_FULL) {
    throw new FinanceDomainError("VALIDATION", "Ставка комиссии вне диапазона");
  }

  const commissionAmount = applyCommissionBps(input.grossAmount, bps);
  const ownerShareAmount = input.grossAmount - commissionAmount;

  if (commissionAmount + ownerShareAmount !== input.grossAmount) {
    throw new FinanceDomainError("INTERNAL", "Нарушено тождество gross = commission + ownerShare");
  }

  return {
    currency: "RUB",
    grossAmount: input.grossAmount,
    commissionRateBps: bps,
    commissionRatePercent: commissionRatePercentFromBps(bps),
    commissionAmount,
    ownerShareAmount: isOperatorOwned ? 0 : ownerShareAmount,
    managementType: input.managementType,
    isOperatorOwned,
  };
}

/** Resolve bps to lock from Property. OWN → 100%. COMMISSION → commissionDaily or 0. */
export function resolveCommissionRateBpsFromProperty(property: {
  managementType: ManagementType;
  commissionDaily: number | null;
}): number {
  if (property.managementType === "OWN") {
    return BPS_FULL;
  }
  if (property.commissionDaily == null) {
    return 0;
  }
  return percentToBps(property.commissionDaily);
}

/**
 * Lock commission snapshot once. Never overwrite an existing snapshot.
 */
export async function ensureCommissionSnapshot(bookingId: string): Promise<number> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { property: { select: { managementType: true, commissionDaily: true } } },
  });
  if (!booking) {
    throw new FinanceDomainError("NOT_FOUND", "Бронирование не найдено");
  }
  if (booking.commissionRateBps != null) {
    return booking.commissionRateBps;
  }

  const bps = resolveCommissionRateBpsFromProperty(booking.property);
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { commissionRateBps: bps },
  });
  return updated.commissionRateBps!;
}

export async function getBookingPayments(bookingId: string): Promise<BookingPaymentView[]> {
  const rows = await prisma.bookingPayment.findMany({
    where: { bookingId },
    include: { refunds: { orderBy: { refundedAt: "asc" } } },
    orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
  });

  return rows.map((row) => {
    const refundedAmount = sumMoney(row.refunds.map((r) => r.amount));
    return {
      id: row.id,
      amount: row.amount,
      paidAt: row.paidAt.toISOString(),
      method: row.method,
      note: row.note,
      refundedAmount,
      netAmount: row.amount - refundedAmount,
      createdAt: row.createdAt.toISOString(),
      refunds: row.refunds.map((r) => ({
        id: r.id,
        amount: r.amount,
        refundedAt: r.refundedAt.toISOString(),
        note: r.note,
      })),
    };
  });
}

export async function getBookingPaidAmount(bookingId: string): Promise<number> {
  const payments = await prisma.bookingPayment.findMany({
    where: { bookingId },
    select: { amount: true, refunds: { select: { amount: true } } },
  });
  const paid = sumMoney(payments.map((p) => p.amount));
  const refunded = sumMoney(payments.flatMap((p) => p.refunds.map((r) => r.amount)));
  return paid - refunded;
}

export async function getBookingRemainingAmount(bookingId: string): Promise<number> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { totalAmount: true },
  });
  if (!booking) {
    throw new FinanceDomainError("NOT_FOUND", "Бронирование не найдено");
  }
  const netPaid = await getBookingPaidAmount(bookingId);
  return booking.totalAmount - netPaid;
}

export async function syncBookingPaymentTransaction(paymentId: string) {
  const payment = await prisma.bookingPayment.findUnique({
    where: { id: paymentId },
    include: {
      booking: {
        select: {
          id: true,
          propertyId: true,
          property: { select: { managementType: true, rentCollectionMode: true } },
        },
      },
    },
  });
  if (!payment) {
    throw new FinanceDomainError("NOT_FOUND", "Платёж не найден");
  }

  const { managementType, rentCollectionMode } = payment.booking.property;

  if (managementType === "COMMISSION" && rentCollectionMode === "OWNER_DIRECT") {
    return null;
  }

  const sourceKey = bookingPaymentRentSourceKey(payment.id);
  const existing = await prisma.financialTransaction.findUnique({
    where: { sourceKey },
  });
  if (existing) {
    return existing;
  }

  const economicRole =
    managementType === "OWN" ? ("BUSINESS_REVENUE" as const) : ("PASS_THROUGH" as const);

  return createFinancialTransaction({
    propertyId: payment.booking.propertyId,
    bookingId: payment.booking.id,
    type: "INCOME",
    category: "RENT_PAYMENT",
    economicRole,
    amount: payment.amount,
    occurredAt: payment.paidAt,
    description: payment.note ?? `Оплата бронирования`,
    sourceType: "BOOKING",
    sourceId: payment.id,
    sourceKey,
  });
}

export async function syncBookingRefundTransaction(refundId: string) {
  const refund = await prisma.bookingPaymentRefund.findUnique({
    where: { id: refundId },
    include: {
      payment: {
        include: {
          booking: {
            select: {
              id: true,
              propertyId: true,
              property: { select: { managementType: true, rentCollectionMode: true } },
            },
          },
        },
      },
    },
  });
  if (!refund) {
    throw new FinanceDomainError("NOT_FOUND", "Возврат не найден");
  }

  const { managementType, rentCollectionMode } = refund.payment.booking.property;

  if (managementType === "COMMISSION" && rentCollectionMode === "OWNER_DIRECT") {
    return null;
  }

  const sourceKey = bookingPaymentRefundSourceKey(refund.id);
  const existing = await prisma.financialTransaction.findUnique({
    where: { sourceKey },
  });
  if (existing) {
    return existing;
  }

  const economicRole =
    managementType === "OWN"
      ? ("BUSINESS_EXPENSE" as const)
      : ("PASS_THROUGH" as const);

  return createFinancialTransaction({
    propertyId: refund.payment.booking.propertyId,
    bookingId: refund.payment.booking.id,
    type: "EXPENSE",
    category: "GUEST_REFUND",
    economicRole,
    amount: refund.amount,
    occurredAt: refund.refundedAt,
    description: refund.note ?? `Возврат гостю`,
    sourceType: "BOOKING",
    sourceId: refund.id,
    sourceKey,
  });
}

export async function recordBookingPayment(
  bookingId: string,
  input: RecordBookingPaymentInput,
) {
  assertPositiveMoney(input.amount);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true },
  });
  if (!booking) {
    throw new FinanceDomainError("NOT_FOUND", "Бронирование не найдено");
  }
  if (booking.status === "CANCELLED") {
    throw new FinanceDomainError(
      "VALIDATION",
      "Нельзя принять оплату по отменённому бронированию",
    );
  }

  await ensureCommissionSnapshot(bookingId);

  const payment = await prisma.bookingPayment.create({
    data: {
      bookingId,
      amount: input.amount,
      paidAt: input.paidAt,
      method: input.method ?? null,
      note: input.note ?? null,
    },
  });

  await syncBookingPaymentTransaction(payment.id);
  return payment;
}

export async function recordBookingRefund(
  bookingId: string,
  paymentId: string,
  input: RecordBookingRefundInput,
) {
  assertPositiveMoney(input.amount);

  const payment = await prisma.bookingPayment.findFirst({
    where: { id: paymentId, bookingId },
    include: { refunds: true },
  });
  if (!payment) {
    throw new FinanceDomainError("NOT_FOUND", "Платёж не найден");
  }

  const alreadyRefunded = sumMoney(payment.refunds.map((r) => r.amount));
  const available = payment.amount - alreadyRefunded;
  if (input.amount > available) {
    throw new FinanceDomainError(
      "VALIDATION",
      `Возврат превышает доступную сумму платежа (${available} ₽)`,
    );
  }

  const refund = await prisma.bookingPaymentRefund.create({
    data: {
      paymentId,
      amount: input.amount,
      refundedAt: input.refundedAt,
      note: input.note,
    },
  });

  await syncBookingRefundTransaction(refund.id);
  return refund;
}

/**
 * Reconcile: ensure every payment/refund has a ledger row (idempotent).
 * Does not rewrite historical amounts or post commission/owner as cash.
 */
export async function reconcileBookingFinance(bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new FinanceDomainError("NOT_FOUND", "Бронирование не найдено");
  }

  await ensureCommissionSnapshot(bookingId);

  const payments = await prisma.bookingPayment.findMany({
    where: { bookingId },
    include: { refunds: true },
  });

  for (const payment of payments) {
    await syncBookingPaymentTransaction(payment.id);
    for (const refund of payment.refunds) {
      await syncBookingRefundTransaction(refund.id);
    }
  }

  return getBookingFinanceState(bookingId);
}

export async function getBookingFinanceState(bookingId: string): Promise<BookingFinanceState> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      property: { select: { managementType: true, commissionDaily: true } },
    },
  });
  if (!booking) {
    throw new FinanceDomainError("NOT_FOUND", "Бронирование не найдено");
  }

  const bps =
    booking.commissionRateBps ??
    resolveCommissionRateBpsFromProperty(booking.property);

  const breakdown = calculateBookingFinancialBreakdown({
    grossAmount: booking.totalAmount,
    commissionRateBps: bps,
    managementType: booking.property.managementType,
  });

  const payments = await getBookingPayments(bookingId);
  const paidAmount = sumMoney(payments.map((p) => p.amount));
  const refundedAmount = sumMoney(payments.map((p) => p.refundedAmount));
  const netPaidAmount = paidAmount - refundedAmount;
  const remainingRaw = booking.totalAmount - netPaidAmount;
  const remainingAmount = remainingRaw > 0 ? remainingRaw : 0;
  const overpaymentAmount = remainingRaw < 0 ? -remainingRaw : 0;

  const commissionOnReceived = applyCommissionBps(netPaidAmount, breakdown.commissionRateBps);
  const ownerShareOnReceived = breakdown.isOperatorOwned
    ? 0
    : netPaidAmount - commissionOnReceived;

  return {
    bookingId,
    status: booking.status,
    breakdown: {
      ...breakdown,
      // If snapshot not locked yet, still show provisional from property
      commissionRateBps: bps,
      commissionRatePercent: commissionRatePercentFromBps(bps),
    },
    paidAmount,
    refundedAmount,
    netPaidAmount,
    remainingAmount,
    overpaymentAmount,
    commissionAccrued: breakdown.commissionAmount,
    ownerShareAccrued: breakdown.ownerShareAmount,
    commissionOnReceived,
    ownerShareOnReceived,
    payments,
  };
}
