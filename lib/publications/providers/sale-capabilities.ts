/**
 * Explicit SalePublication provider capability states.
 * Never claim READY without a confirmed official contract + implemented serializer.
 */
export const SALE_PROVIDER_CAPABILITY_STATES = [
  "READY",
  "BLOCKED_BY_PROVIDER_ACCESS",
  "BLOCKED_BY_PROVIDER_CONFIRMATION",
  "NOT_IMPLEMENTED",
] as const;

export type SaleProviderCapabilityState = (typeof SALE_PROVIDER_CAPABILITY_STATES)[number];

export type SaleProviderCapabilities = {
  code: "CIAN" | "AVITO" | "DOMCLICK";
  feed: SaleProviderCapabilityState;
  preview: SaleProviderCapabilityState;
  statusSync: SaleProviderCapabilityState;
  unpublish: SaleProviderCapabilityState;
  credentialsRequired: boolean;
  /** Human-readable reason when feed/preview are blocked. */
  blockerReason: string | null;
};

export function isSaleProviderFeedReady(capabilities: SaleProviderCapabilities) {
  return capabilities.feed === "READY";
}

export function isSaleProviderPreviewReady(capabilities: SaleProviderCapabilities) {
  return capabilities.preview === "READY";
}
