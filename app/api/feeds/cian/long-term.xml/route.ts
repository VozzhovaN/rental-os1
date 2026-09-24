import { buildPublicCianLongTermFeed } from "@/lib/publications/providers/cian";
import { withPublicRoute } from "@/lib/auth/with-public-route";

export const dynamic = "force-dynamic";

/**
 * Public CIAN long-term account feed.
 * One feed per CIAN account; listings included via Publication inclusion statuses.
 * No credentials in URL. No CRM diagnostics. No arbitrary ids.
 */
export const GET = withPublicRoute(async () => {
  const feed = await buildPublicCianLongTermFeed();

  return new Response(feed.xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
});
