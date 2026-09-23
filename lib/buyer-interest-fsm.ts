import type { BuyerInterestStatus } from "@prisma/client";

/** Full FSM for future Viewing/Deposit/Purchase workflows. */
export const BUYER_INTEREST_TRANSITIONS: Record<
  BuyerInterestStatus,
  readonly BuyerInterestStatus[]
> = {
  INTERESTED: ["VIEWING_REQUESTED", "VIEWING_SCHEDULED", "THINKING", "REFUSED"],
  VIEWING_REQUESTED: ["VIEWING_SCHEDULED", "REFUSED"],
  VIEWING_SCHEDULED: ["VIEWING_COMPLETED", "REFUSED"],
  VIEWING_COMPLETED: ["THINKING", "DEPOSIT_PAID", "REFUSED"],
  THINKING: ["DEPOSIT_PAID", "REFUSED"],
  // REFUSED allowed for sale-driven refusal / explicit deposit walk-away.
  DEPOSIT_PAID: ["PURCHASED", "REFUSED"],
  PURCHASED: [],
  REFUSED: [],
};

/** Manual Stage 9.2/9.3 transitions. Viewing/Deposit workflows set their own statuses. */
export const BUYER_INTEREST_MANUAL_TARGETS = [
  "INTERESTED",
  "VIEWING_REQUESTED",
  "THINKING",
  "REFUSED",
] as const;

export type BuyerInterestManualTarget = (typeof BUYER_INTEREST_MANUAL_TARGETS)[number];

export function canTransitionBuyerInterest(
  from: BuyerInterestStatus,
  to: BuyerInterestStatus,
): boolean {
  return BUYER_INTEREST_TRANSITIONS[from].includes(to);
}

export function assertBuyerInterestTransition(
  from: BuyerInterestStatus,
  to: BuyerInterestStatus,
): void {
  if (!canTransitionBuyerInterest(from, to)) {
    throw new Error(`Переход ${from} → ${to} недопустим`);
  }
}

export function isManualBuyerInterestTarget(status: string): status is BuyerInterestManualTarget {
  return (BUYER_INTEREST_MANUAL_TARGETS as readonly string[]).includes(status);
}

export function getManualTargetsFrom(from: BuyerInterestStatus): BuyerInterestManualTarget[] {
  return BUYER_INTEREST_TRANSITIONS[from].filter(isManualBuyerInterestTarget);
}
