import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, getSessionTtlMs } from "@/lib/auth/constants";

export function isProductionEnv(nodeEnv: string | undefined = process.env.NODE_ENV) {
  return nodeEnv === "production";
}

/**
 * Host-only cookie (Domain intentionally unset).
 * Logout must use the same Path/SameSite/Secure/HttpOnly attributes.
 */
export function sessionCookieOptions(
  maxAgeSeconds?: number,
  options?: { nodeEnv?: string },
) {
  const maxAge = maxAgeSeconds ?? Math.floor(getSessionTtlMs() / 1000);

  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProductionEnv(options?.nodeEnv ?? process.env.NODE_ENV),
    path: "/",
    maxAge,
  };
}

export function setSessionCookie(response: NextResponse, rawToken: string) {
  response.cookies.set(SESSION_COOKIE_NAME, rawToken, sessionCookieOptions());
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(0),
    maxAge: 0,
  });
}

/** Clear stale session cookie from Server Components / layouts. */
export async function clearSessionCookieFromJar() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(0),
    maxAge: 0,
  });
}

export function readSessionTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      const value = trimmed.slice(SESSION_COOKIE_NAME.length + 1);
      return value || null;
    }
  }
  return null;
}

export function readSessionTokenFromRequest(request: Request): string | null {
  return readSessionTokenFromCookieHeader(request.headers.get("cookie"));
}

export async function readSessionTokenFromNextCookies(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE_NAME)?.value ?? null;
}
