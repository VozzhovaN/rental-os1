import type { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-json";
import { enforceApiAccess } from "@/lib/auth/require-auth";

const NO_STORE = "no-store";

function applyNoStore(response: Response): Response {
  response.headers.set("Cache-Control", NO_STORE);
  return response;
}

/**
 * Canonical full-validation wrapper for AUTH_REQUIRED (and AUTH_OPTIONAL) route handlers.
 * Runs enforceApiAccess (session hash + expiry + active user + CSRF for mutations),
 * then sets Cache-Control: no-store on the handler response.
 * Unexpected errors never return Prisma/stack details to the client.
 */
export function withApiAuth<TArgs extends unknown[]>(
  handler: (request: Request, ...args: TArgs) => Promise<Response>,
): (request: Request, ...args: TArgs) => Promise<Response> {
  return async (request: Request, ...args: TArgs) => {
    const denied = await enforceApiAccess(request);
    if (denied) {
      return applyNoStore(denied);
    }
    try {
      const result = await handler(request, ...args);
      return applyNoStore(result);
    } catch (error) {
      console.error(
        "[api]",
        request.method,
        new URL(request.url).pathname,
        error instanceof Error ? error.name : "unknown",
      );
      return applyNoStore(
        jsonError("Не удалось выполнить операцию", 500, { code: "INTERNAL_ERROR" }),
      );
    }
  };
}

/** Alias used by docs / call sites. */
export const requireApiAuth = enforceApiAccess;

export type { NextResponse };
