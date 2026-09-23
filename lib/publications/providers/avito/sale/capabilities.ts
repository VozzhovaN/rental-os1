import type { SaleProviderCapabilities } from "@/lib/publications/providers/sale-capabilities";

/**
 * Avito sale publication capabilities (secondary residential).
 *
 * Mechanism (CONFIRMED product): Autoload XML/CSV/Excel for realty after tariff.
 * Category field map for «Квартиры / Продам»: NOT publicly confirmed without
 * live Autoload realty template (autoload.avito.ru/format/realty captcha/timeout;
 * Stage 8.2 audit + Stage 10.3 re-check).
 *
 * Therefore: no serializer / public sale feed in this stage.
 */
export const AVITO_SALE_CAPABILITIES: SaleProviderCapabilities = {
  code: "AVITO",
  feed: "BLOCKED_BY_PROVIDER_CONFIRMATION",
  preview: "BLOCKED_BY_PROVIDER_CONFIRMATION",
  statusSync: "BLOCKED_BY_PROVIDER_ACCESS",
  unpublish: "BLOCKED_BY_PROVIDER_CONFIRMATION",
  credentialsRequired: true,
  blockerReason:
    "Нет подтверждённого официального шаблона Autoload «Квартиры / Продам». Serializer не реализован.",
};

export const AVITO_SALE_FEED = AVITO_SALE_CAPABILITIES.feed;
export const AVITO_SALE_STATUS_SYNC = AVITO_SALE_CAPABILITIES.statusSync;
export const AVITO_SALE_UNPUBLISH = AVITO_SALE_CAPABILITIES.unpublish;
