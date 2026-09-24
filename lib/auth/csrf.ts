/**
 * SameSite=Lax cookies + Origin/Referer validation for mutating authenticated API calls.
 * When APP_ORIGIN is set, Origin/Referer must match that canonical origin (scheme + host).
 * Without APP_ORIGIN (dev only): fall back to Host header comparison.
 */

import { getAppOrigin } from "@/lib/auth/env";

export type OriginCheckResult = { ok: true } | { ok: false; reason: string };

function parseOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return null;
  }
}

function requestOriginFromHost(request: Request): string | null {
  const host = request.headers.get("host");
  if (!host) return null;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (new URL(request.url).protocol === "https:" ? "https" : "http");
  try {
    return new URL(`${proto}://${host}`).origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Allow same-origin browser requests. Reject clearly cross-origin mutating calls.
 * Missing Origin/Referer allowed for non-browser tooling (curl) when cookie+session still required.
 */
export function assertTrustedOrigin(request: Request): OriginCheckResult {
  const configured = (() => {
    try {
      return getAppOrigin()?.toLowerCase() ?? null;
    } catch (error) {
      // In production APP_ORIGIN is mandatory; never silently fall back to the
      // spoofable Host header. Re-throw so the misconfiguration fails closed.
      if (process.env.NODE_ENV === "production") {
        throw error;
      }
      return null;
    }
  })();

  const trustedOrigin = configured ?? requestOriginFromHost(request);
  if (!trustedOrigin) {
    return { ok: false, reason: "missing_trusted_origin" };
  }

  const originHeader = parseOrigin(request.headers.get("origin"));
  if (originHeader) {
    return originHeader === trustedOrigin
      ? { ok: true }
      : { ok: false, reason: "origin_mismatch" };
  }

  const refererOrigin = parseOrigin(request.headers.get("referer"));
  if (refererOrigin) {
    return refererOrigin === trustedOrigin
      ? { ok: true }
      : { ok: false, reason: "referer_mismatch" };
  }

  return { ok: true };
}
