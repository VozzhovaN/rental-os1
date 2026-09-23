import type { SaleProviderCapabilityState } from "@/lib/publications/providers/sale-capabilities";

export const providerCapabilityLabels: Record<SaleProviderCapabilityState, string> = {
  READY: "Доступно",
  BLOCKED_BY_PROVIDER_ACCESS: "Требуется доступ провайдера",
  BLOCKED_BY_PROVIDER_CONFIRMATION: "Ожидается подтверждение провайдера",
  NOT_IMPLEMENTED: "Пока не реализовано",
};

export const providerCapabilityTone: Record<
  SaleProviderCapabilityState,
  "success" | "warning" | "neutral" | "danger"
> = {
  READY: "success",
  BLOCKED_BY_PROVIDER_ACCESS: "warning",
  BLOCKED_BY_PROVIDER_CONFIRMATION: "warning",
  NOT_IMPLEMENTED: "neutral",
};
