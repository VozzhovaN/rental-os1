import { buildPublicCianSaleFeed } from "@/lib/publications/providers/cian/sale";

export const dynamic = "force-dynamic";

/**
 * Public CIAN sale feed. Separate from /api/feeds/cian/long-term.xml.
 * XML generation never marks SalePublication PUBLISHED.
 */
export async function GET() {
  const feed = await buildPublicCianSaleFeed();

  return new Response(feed.xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
