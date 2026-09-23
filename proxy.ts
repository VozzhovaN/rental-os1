import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import {
  classifyApiPath,
  isCrmPath,
  isLoginPath,
  isMutatingMethod,
  ROUTE_ACCESS,
} from "@/lib/auth/route-access";
import { assertTrustedOrigin } from "@/lib/auth/csrf";

/**
 * Optimistic proxy gate (cookie presence + CSRF Origin).
 * Full session hash/expiry/isActive validation runs in withApiAuth / CRM layout.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isLoginPath(pathname)) {
    return NextResponse.next();
  }

  if (isCrmPath(pathname)) {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
    return NextResponse.next();
  }

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const access = classifyApiPath(pathname);

  if (access === ROUTE_ACCESS.PUBLIC || access === ROUTE_ACCESS.EXTERNAL_INTEGRATION) {
    return NextResponse.next();
  }

  if (access === "AUTH_OPTIONAL") {
    if (isMutatingMethod(request.method) && request.cookies.get(SESSION_COOKIE_NAME)?.value) {
      const origin = assertTrustedOrigin(request);
      if (!origin.ok) {
        return NextResponse.json(
          { error: "Запрос отклонён (CSRF)", code: "FORBIDDEN" },
          { status: 403, headers: { "Cache-Control": "no-store" } },
        );
      }
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json(
      { error: "Требуется авторизация", code: "UNAUTHORIZED" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (isMutatingMethod(request.method)) {
    const origin = assertTrustedOrigin(request);
    if (!origin.ok) {
      return NextResponse.json(
        { error: "Запрос отклонён (CSRF)", code: "FORBIDDEN" },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/crm", "/crm/:path*", "/api/:path*", "/login"],
};
