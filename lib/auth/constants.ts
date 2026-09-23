/** HTTP-only session cookie name. */
export const SESSION_COOKIE_NAME = "rental_os_session";

/** Default session lifetime (days). Override with SESSION_TTL_DAYS. */
export const DEFAULT_SESSION_TTL_DAYS = 7;

/** Minimum password length for bootstrap / admin passwords. */
export const MIN_PASSWORD_LENGTH = 12;

/** Opaque session token byte length (raw random bytes before encoding). */
export const SESSION_TOKEN_BYTES = 32;

/** Throttle Session.lastUsedAt writes (20 minutes). */
export const LAST_USED_TOUCH_INTERVAL_MS = 20 * 60 * 1000;

export const MULTI_INSTANCE_RATE_LIMIT = "PRODUCTION_HARDENING_PENDING" as const;

export function getSessionTtlMs(): number {
  const raw = process.env.SESSION_TTL_DAYS?.trim();
  const days = raw ? Number(raw) : DEFAULT_SESSION_TTL_DAYS;
  if (!Number.isFinite(days) || days <= 0 || days > 365) {
    return DEFAULT_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
  }
  return days * 24 * 60 * 60 * 1000;
}
