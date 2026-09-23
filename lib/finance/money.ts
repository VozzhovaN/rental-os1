/**
 * Financial money helpers.
 *
 * Storage convention (aligned with Booking.totalAmount / Property.dailyPrice):
 * integer RUB major units (rubles), never floating-point arithmetic.
 *
 * Sign convention:
 * - DB `amount` is always a positive integer
 * - signed contribution for aggregates comes from type (+ adjustmentDirection)
 */

export const FINANCIAL_CURRENCY_RUB = "RUB" as const;

export type FinancialMoney = number;

export function assertPositiveMoney(amount: unknown): asserts amount is number {
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
    throw new FinanceDomainError("VALIDATION", "Сумма должна быть целым числом рублей больше 0");
  }
  if (!Number.isSafeInteger(amount)) {
    throw new FinanceDomainError("VALIDATION", "Сумма вне допустимого диапазона");
  }
}

export function assertNonNegativeMoney(amount: unknown): asserts amount is number {
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 0) {
    throw new FinanceDomainError("VALIDATION", "Сумма должна быть целым числом рублей ≥ 0");
  }
  if (!Number.isSafeInteger(amount)) {
    throw new FinanceDomainError("VALIDATION", "Сумма вне допустимого диапазона");
  }
}

/**
 * Integer half-up division for positive values.
 * Example: divRoundHalfUp(15_000, 10_000) === 2 (1.5 → 2).
 */
export function divRoundHalfUp(numerator: number, denominator: number): number {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator <= 0) {
    throw new FinanceDomainError("INTERNAL", "Некорректное целочисленное деление");
  }
  if (numerator < 0) {
    throw new FinanceDomainError("INTERNAL", "Отрицательный числитель недопустим");
  }
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}

/**
 * Apply commission basis points to gross (integer RUB).
 * 10_000 bps = 100%. Rounding: half-up to nearest ruble (minimal money unit in this CRM).
 */
export function applyCommissionBps(grossAmount: number, bps: number): number {
  assertNonNegativeMoney(grossAmount);
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
    throw new FinanceDomainError("VALIDATION", "Ставка комиссии вне диапазона 0–100%");
  }
  return divRoundHalfUp(grossAmount * bps, 10_000);
}

/**
 * Convert Property.commissionDaily percent (Float config) → integer basis points at domain boundary.
 * 20 → 2000, 20.5 → 2050. After snapshot, money math uses only integers.
 */
export function percentToBps(percent: number): number {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new FinanceDomainError("VALIDATION", "Процент комиссии должен быть от 0 до 100");
  }
  return Math.round(percent * 100);
}

export function bpsToPercentDisplay(bps: number): number {
  if (!Number.isInteger(bps)) {
    throw new FinanceDomainError("INTERNAL", "bps must be integer");
  }
  // Exact for stored bps (centipercent of percent): 2050 → 20.5 via integer path for display only
  return bps / 100;
}

/** Exact integer sum — no float. */
export function sumMoney(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) {
    if (!Number.isInteger(value)) {
      throw new FinanceDomainError("INTERNAL", "Нецелое денежное значение в агрегате");
    }
    total += value;
  }
  return total;
}

export class FinanceDomainError extends Error {
  code: "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "FORBIDDEN" | "INTERNAL";

  constructor(code: FinanceDomainError["code"], message: string) {
    super(message);
    this.name = "FinanceDomainError";
    this.code = code;
  }
}
