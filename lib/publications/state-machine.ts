import type { PublicationStatus } from "@prisma/client";

export const PUBLICATION_STATUSES = [
  "NOT_PUBLISHED",
  "PUBLISHING",
  "PUBLISHED",
  "UPDATE_PENDING",
  "UNPUBLISHING",
  "UNPUBLISHED",
  "ERROR",
] as const;

export type PublicationEvent =
  | "START_PUBLISH"
  | "CONFIRM_PUBLISHED"
  | "START_UPDATE"
  | "START_UNPUBLISH"
  | "CONFIRM_UNPUBLISHED"
  | "FAIL";

const TRANSITIONS: Record<PublicationStatus, Partial<Record<PublicationEvent, PublicationStatus>>> = {
  NOT_PUBLISHED: {
    START_PUBLISH: "PUBLISHING",
  },
  PUBLISHING: {
    CONFIRM_PUBLISHED: "PUBLISHED",
    FAIL: "ERROR",
  },
  PUBLISHED: {
    START_UPDATE: "UPDATE_PENDING",
    START_UNPUBLISH: "UNPUBLISHING",
  },
  UPDATE_PENDING: {
    CONFIRM_PUBLISHED: "PUBLISHED",
    FAIL: "ERROR",
  },
  UNPUBLISHING: {
    CONFIRM_UNPUBLISHED: "UNPUBLISHED",
    FAIL: "ERROR",
  },
  UNPUBLISHED: {
    START_PUBLISH: "PUBLISHING",
  },
  ERROR: {
    START_PUBLISH: "PUBLISHING",
    START_UPDATE: "UPDATE_PENDING",
    START_UNPUBLISH: "UNPUBLISHING",
  },
};

export function nextPublicationStatus(
  current: PublicationStatus,
  event: PublicationEvent,
): PublicationStatus | null {
  return TRANSITIONS[current][event] ?? null;
}

export function canTransitionPublication(
  current: PublicationStatus,
  event: PublicationEvent,
  context: { externalId: string | null } = { externalId: null },
) {
  if (current === "ERROR" && (event === "START_UPDATE" || event === "START_UNPUBLISH") && !context.externalId) {
    return false;
  }

  return nextPublicationStatus(current, event) !== null;
}

export function assertPublicationTransition(
  current: PublicationStatus,
  event: PublicationEvent,
  context: { externalId: string | null } = { externalId: null },
) {
  if (!canTransitionPublication(current, event, context)) {
    throw new Error(`Недопустимый переход Publication: ${current} + ${event}`);
  }

  return nextPublicationStatus(current, event)!;
}
