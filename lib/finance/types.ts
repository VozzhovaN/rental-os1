import type {
  AdjustmentDirection,
  EconomicRole,
  FinancialCategory,
  FinancialSourceType,
  FinancialTransactionType,
} from "@prisma/client";

export const FINANCIAL_TRANSACTION_TYPES = [
  "INCOME",
  "EXPENSE",
  "OWNER_PAYOUT",
  "ADJUSTMENT",
] as const satisfies readonly FinancialTransactionType[];

export const FINANCIAL_CATEGORIES = [
  "RENT_PAYMENT",
  "OPERATOR_COMMISSION",
  "OWNER_SHARE",
  "CLEANING",
  "LAUNDRY",
  "REPAIR",
  "UTILITIES",
  "SUPPLIES",
  "PLATFORM_COMMISSION",
  "TAX",
  "ACQUIRING",
  "ADVERTISING",
  "OTHER_EXPENSE",
  "OWNER_PAYOUT",
  "ADJUSTMENT",
  "GUEST_REFUND",
  "SECURITY_DEPOSIT_RECEIVED",
  "SECURITY_DEPOSIT_RETURNED",
] as const satisfies readonly FinancialCategory[];

export const EXPENSE_CATEGORIES = [
  "CLEANING",
  "LAUNDRY",
  "REPAIR",
  "UTILITIES",
  "SUPPLIES",
  "PLATFORM_COMMISSION",
  "TAX",
  "ACQUIRING",
  "ADVERTISING",
  "OTHER_EXPENSE",
  "GUEST_REFUND",
  "SECURITY_DEPOSIT_RETURNED",
] as const satisfies readonly FinancialCategory[];

/** Operator P&L expense categories (Stage 12.4). */
export const OPERATOR_EXPENSE_CATEGORIES = [
  "TAX",
  "ACQUIRING",
  "CLEANING",
  "UTILITIES",
  "ADVERTISING",
  "REPAIR",
  "SUPPLIES",
  "PLATFORM_COMMISSION",
  "LAUNDRY",
  "OTHER_EXPENSE",
] as const satisfies readonly FinancialCategory[];

export const FINANCIAL_SOURCE_TYPES = [
  "MANUAL",
  "BOOKING",
  "LONG_TERM",
  "OWNER_SETTLEMENT",
  "COMMISSION_PAYMENT",
  "SYSTEM_ADJUSTMENT",
] as const satisfies readonly FinancialSourceType[];

export const ECONOMIC_ROLES = [
  "BUSINESS_REVENUE",
  "PASS_THROUGH",
  "BUSINESS_EXPENSE",
  "NEUTRAL",
] as const satisfies readonly EconomicRole[];

export const ADJUSTMENT_DIRECTIONS = ["CREDIT", "DEBIT"] as const satisfies readonly AdjustmentDirection[];

export const economicRoleLabels: Record<EconomicRole, string> = {
  BUSINESS_REVENUE: "Выручка бизнеса",
  PASS_THROUGH: "Транзит",
  BUSINESS_EXPENSE: "Расход бизнеса",
  NEUTRAL: "Нейтрально",
};

export const financialCategoryLabels: Record<FinancialCategory, string> = {
  RENT_PAYMENT: "Арендный платёж",
  OPERATOR_COMMISSION: "Комиссия оператора",
  OWNER_SHARE: "Доля собственника",
  CLEANING: "Уборка",
  LAUNDRY: "Стирка / текстиль",
  REPAIR: "Ремонт",
  UTILITIES: "Коммунальные",
  SUPPLIES: "Расходники",
  PLATFORM_COMMISSION: "Комиссия площадки",
  TAX: "Налоги",
  ACQUIRING: "Эквайринг",
  ADVERTISING: "Реклама",
  OTHER_EXPENSE: "Прочий расход",
  OWNER_PAYOUT: "Выплата собственнику",
  ADJUSTMENT: "Корректировка",
  GUEST_REFUND: "Возврат гостю",
  SECURITY_DEPOSIT_RECEIVED: "Депозит получен",
  SECURITY_DEPOSIT_RETURNED: "Депозит возвращён",
};

export const financialTypeLabels: Record<FinancialTransactionType, string> = {
  INCOME: "Доход",
  EXPENSE: "Расход",
  OWNER_PAYOUT: "Выплата собственнику",
  ADJUSTMENT: "Корректировка",
};

/** Idempotent ledger keys for booking cash facts (not allocation). */
export function bookingPaymentRentSourceKey(paymentId: string) {
  return `BOOKING_PAYMENT:${paymentId}:RENT`;
}

export function bookingPaymentRefundSourceKey(refundId: string) {
  return `BOOKING_PAYMENT_REFUND:${refundId}:REFUND`;
}

export function commissionPaymentSourceKey(paymentId: string) {
  return `COMMISSION_PAYMENT:${paymentId}`;
}

/** Reserved allocation keys — not posted as cash INCOME in Stage 12.2. */
export function bookingFinanceSourceKey(
  bookingId: string,
  kind: "RENT" | "COMMISSION" | "OWNER_SHARE",
) {
  return `BOOKING:${bookingId}:${kind}`;
}

/**
 * Signed contribution to net cash movement (integer RUB).
 * INCOME +, EXPENSE −, OWNER_PAYOUT −, ADJUSTMENT ± by direction.
 */
export function signedCashContribution(input: {
  type: FinancialTransactionType;
  amount: number;
  adjustmentDirection: AdjustmentDirection | null;
}): number {
  switch (input.type) {
    case "INCOME":
      return input.amount;
    case "EXPENSE":
    case "OWNER_PAYOUT":
      return -input.amount;
    case "ADJUSTMENT":
      if (input.adjustmentDirection === "CREDIT") return input.amount;
      if (input.adjustmentDirection === "DEBIT") return -input.amount;
      throw new Error("ADJUSTMENT requires adjustmentDirection");
    default:
      throw new Error("Unknown financial type");
  }
}
