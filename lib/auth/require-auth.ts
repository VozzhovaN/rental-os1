import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-json";
import {
  getSessionByRawToken,
  type SessionUser,
  type ValidSession,
} from "@/lib/auth/session";
import {
  clearSessionCookie,
  readSessionTokenFromNextCookies,
  readSessionTokenFromRequest,
} from "@/lib/auth/cookies";
import { classifyApiPath, isMutatingMethod, ROUTE_ACCESS } from "@/lib/auth/route-access";
import { assertTrustedOrigin } from "@/lib/auth/csrf";

export class AuthError extends Error {
  code: "UNAUTHORIZED" | "FORBIDDEN" | "CSRF";

  constructor(code: AuthError["code"], message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

export async function authenticateRequest(request: Request): Promise<ValidSession> {
  const token = readSessionTokenFromRequest(request);
  const session = await getSessionByRawToken(token);
  if (!session) {
    throw new AuthError("UNAUTHORIZED", "Требуется авторизация");
  }
  return session;
}

export async function requireAuth(request: Request): Promise<ValidSession> {
  return authenticateRequest(request);
}

export async function getCurrentUserFromCookies(): Promise<SessionUser | null> {
  const token = await readSessionTokenFromNextCookies();
  const session = await getSessionByRawToken(token);
  return session?.user ?? null;
}

/** Full session validation for Server Components; null if stale/invalid. */
export async function getValidSessionFromCookies(): Promise<ValidSession | null> {
  const token = await readSessionTokenFromNextCookies();
  return getSessionByRawToken(token);
}

export function unauthorizedJson() {
  const response = jsonError("Требуется авторизация", 401, { code: "UNAUTHORIZED" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function csrfRejectedJson() {
  const response = jsonError("Запрос отклонён (CSRF)", 403, { code: "FORBIDDEN" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/**
 * Clear stale cookie on 401 when a cookie was present but session invalid.
 */
export function unauthorizedJsonClearingCookie(request: Request) {
  const response = unauthorizedJson();
  if (readSessionTokenFromRequest(request)) {
    clearSessionCookie(response);
  }
  return response;
}

/**
 * Centralized API access: full session validation + CSRF for mutations.
 * Returns a Response to send, or null to continue.
 */
export async function enforceApiAccess(request: Request): Promise<NextResponse | null> {
  const pathname = new URL(request.url).pathname;
  const access = classifyApiPath(pathname);

  if (access === ROUTE_ACCESS.PUBLIC || access === ROUTE_ACCESS.EXTERNAL_INTEGRATION) {
    return null;
  }

  if (access === "AUTH_OPTIONAL") {
    if (isMutatingMethod(request.method)) {
      const origin = assertTrustedOrigin(request);
      if (!origin.ok && readSessionTokenFromRequest(request)) {
        return csrfRejectedJson();
      }
    }
    return null;
  }

  if (isMutatingMethod(request.method)) {
    const origin = assertTrustedOrigin(request);
    if (!origin.ok) {
      return csrfRejectedJson();
    }
  }

  try {
    await requireAuth(request);
    return null;
  } catch {
    return unauthorizedJsonClearingCookie(request);
  }
}
