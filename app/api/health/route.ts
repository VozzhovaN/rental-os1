import { NextResponse } from "next/server";
import { withPublicRoute } from "@/lib/auth/with-public-route";

export const dynamic = "force-dynamic";

/**
 * Liveness probe for deployment/monitoring. Intentionally exposes NO
 * internal details (no versions, env, DB state, or secrets).
 */
export const GET = withPublicRoute(async () => {
  return NextResponse.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
});
