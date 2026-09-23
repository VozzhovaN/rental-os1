export const LISTING_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export const SYNC_STATUSES = [
  "NOT_CONNECTED",
  "CONNECTED",
  "SYNCED",
  "ERROR",
] as const;

export const SALES_CHANNEL_CODES = [
  "AVITO",
  "SUTOCHNO",
  "OSTROVOK",
  "YANDEX_TRAVEL",
  "KORZINA",
  "REGULAR_GUEST",
  "CIAN",
  "DOMCLICK",
  "WEBSITE",
  "LANDING",
  "RECOMMENDATION",
] as const;

export const LONG_TERM_PUBLICATION_CHANNEL_CODES = ["AVITO", "CIAN", "DOMCLICK"] as const;

export type LongTermPublicationChannelCode =
  (typeof LONG_TERM_PUBLICATION_CHANNEL_CODES)[number];

export function isLongTermPublicationChannelCode(
  code: string,
): code is LongTermPublicationChannelCode {
  return (LONG_TERM_PUBLICATION_CHANNEL_CODES as readonly string[]).includes(code);
}

/** SalePublication allowlist. Same codes as long-term; separate contour. */
export const SALE_PUBLICATION_CHANNEL_CODES = ["AVITO", "CIAN", "DOMCLICK"] as const;

export type SalePublicationChannelCode = (typeof SALE_PUBLICATION_CHANNEL_CODES)[number];

export function isSalePublicationChannelCode(
  code: string,
): code is SalePublicationChannelCode {
  return (SALE_PUBLICATION_CHANNEL_CODES as readonly string[]).includes(code);
}

export type SalesChannelCode = (typeof SALES_CHANNEL_CODES)[number];
