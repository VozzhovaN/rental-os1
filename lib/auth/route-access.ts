/**
 * Explicit API route access classification.
 * Runtime: PUBLIC / EXTERNAL exact paths; logout AUTH_OPTIONAL; all other /api/* → AUTH_REQUIRED.
 * Inventory: API_ROUTE_REGISTRY must list every route.ts (classification test).
 */

import { API_ROUTE_REGISTRY } from "@/lib/auth/api-registry";
import { ROUTE_ACCESS, type RouteAccess } from "@/lib/auth/route-access-types";

export { ROUTE_ACCESS, type RouteAccess };

const PUBLIC_API_EXACT = new Set(
  API_ROUTE_REGISTRY.filter((r) => r.access === ROUTE_ACCESS.PUBLIC).map((r) => r.pathPattern),
);

const EXTERNAL_API_EXACT = new Set(
  API_ROUTE_REGISTRY.filter((r) => r.access === ROUTE_ACCESS.EXTERNAL_INTEGRATION).map(
    (r) => r.pathPattern,
  ),
);

const AUTH_OPTIONAL_API_EXACT = new Set(
  API_ROUTE_REGISTRY.filter((r) => r.access === "AUTH_OPTIONAL").map((r) => r.pathPattern),
);

function normalizePathname(pathname: string): string {
  return pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
}

/**
 * Match a concrete request path against a registry pattern with [param] segments.
 */
export function matchPathPattern(pathname: string, pattern: string): boolean {
  const path = normalizePathname(pathname);
  const pathParts = path.split("/");
  const patternParts = pattern.split("/");
  if (pathParts.length !== patternParts.length) return false;
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i]!;
    const vp = pathParts[i]!;
    if (pp.startsWith("[") && pp.endsWith("]")) continue;
    if (pp !== vp) return false;
  }
  return true;
}

export function classifyApiPath(pathname: string): RouteAccess | "AUTH_OPTIONAL" {
  const path = normalizePathname(pathname);

  for (const pattern of PUBLIC_API_EXACT) {
    if (matchPathPattern(path, pattern)) return ROUTE_ACCESS.PUBLIC;
  }
  for (const pattern of EXTERNAL_API_EXACT) {
    if (matchPathPattern(path, pattern)) return ROUTE_ACCESS.EXTERNAL_INTEGRATION;
  }
  for (const pattern of AUTH_OPTIONAL_API_EXACT) {
    if (matchPathPattern(path, pattern)) return "AUTH_OPTIONAL";
  }

  if (path.startsWith("/api/")) {
    return ROUTE_ACCESS.AUTH_REQUIRED;
  }
  return ROUTE_ACCESS.PUBLIC;
}

export function isCrmPath(pathname: string): boolean {
  return pathname === "/crm" || pathname.startsWith("/crm/");
}

export function isLoginPath(pathname: string): boolean {
  return pathname === "/login";
}

export function isMutatingMethod(method: string): boolean {
  const m = method.toUpperCase();
  return m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
}
