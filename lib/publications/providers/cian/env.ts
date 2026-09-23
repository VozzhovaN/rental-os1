export const CIAN_STATUS_SYNC = "BLOCKED_BY_PROVIDER_ACCESS" as const;
export const CIAN_UNPUBLISH = "BLOCKED_BY_PROVIDER_CONFIRMATION" as const;

export type CianEnvConfig = {
  accessKey: string | null;
  feedBaseUrl: string | null;
  accountId: string | null;
};

export function getCianEnvConfig(): CianEnvConfig {
  return {
    accessKey: process.env.CIAN_ACCESS_KEY?.trim() || null,
    feedBaseUrl: process.env.CIAN_FEED_BASE_URL?.trim() || null,
    accountId: process.env.CIAN_ACCOUNT_ID?.trim() || null,
  };
}

/** Access key present — not enough for status sync without live contract. */
export function isCianAccessKeyConfigured() {
  return Boolean(getCianEnvConfig().accessKey);
}

export function isCianStatusSyncAvailable() {
  return false;
}

export function isCianUnpublishAvailable() {
  return false;
}
