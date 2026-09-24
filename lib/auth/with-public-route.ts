import { NextResponse } from "next/server";

/**
 * Wraps a public (unauthenticated) route handler so unexpected exceptions never
 * leak stack traces, DB errors, or internal messages to anonymous callers.
 * Expected/handled responses inside the handler are returned untouched.
 */
export function withPublicRoute<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response> | Response,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      const request = args[0] as Request | undefined;
      let path = "unknown";
      try {
        if (request && typeof request.url === "string") {
          path = new URL(request.url).pathname;
        }
      } catch {
        // ignore URL parse failures
      }
      console.error("[public-route] unhandled error", {
        path,
        name: error instanceof Error ? error.name : "unknown",
      });
      return NextResponse.json(
        { error: "Не удалось выполнить операцию" },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }
  };
}
