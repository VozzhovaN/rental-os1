import type { SaleProviderCapabilities } from "@/lib/publications/providers/sale-capabilities";

/**
 * Domclick sale publication capabilities (secondary residential).
 *
 * Product concept: XML feed registered in partner LK — CONFIRMED as mechanism
 * via public Domclick materials / Stage 8.2 audit.
 * Official secondary («вторичка») field schema: BLOCKED — domclick.ru/validation
 * returns WAF/401 without partner account (Stage 8.2 + Stage 10.3 re-check).
 *
 * New-build developer feeds are out of Stage 10.3 scope.
 * Therefore: no serializer / public sale feed.
 */
export const DOMCLICK_SALE_CAPABILITIES: SaleProviderCapabilities = {
  code: "DOMCLICK",
  feed: "BLOCKED_BY_PROVIDER_ACCESS",
  preview: "BLOCKED_BY_PROVIDER_ACCESS",
  statusSync: "BLOCKED_BY_PROVIDER_ACCESS",
  unpublish: "BLOCKED_BY_PROVIDER_CONFIRMATION",
  credentialsRequired: true,
  blockerReason:
    "Официальная схема XML «вторичка» недоступна без партнёрского аккаунта (validation WAF/401). Serializer не реализован.",
};

export const DOMCLICK_SALE_FEED = DOMCLICK_SALE_CAPABILITIES.feed;
export const DOMCLICK_SALE_STATUS_SYNC = DOMCLICK_SALE_CAPABILITIES.statusSync;
export const DOMCLICK_SALE_UNPUBLISH = DOMCLICK_SALE_CAPABILITIES.unpublish;
