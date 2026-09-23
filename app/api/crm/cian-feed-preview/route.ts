import { jsonUtf8 } from "@/lib/api-json";
import { getLongTermListingById } from "@/lib/long-term-listings";
import { prepareCianFeed } from "@/lib/publications/providers/cian";
import { withApiAuth } from "@/lib/auth/with-api-auth";

/**
 * Internal CRM diagnostic: CIAN feed XML for explicit listing ids.
 * Query: ?ids=id1,id2 — no public feed URL, no CIAN network.
 */
export const GET = withApiAuth(async (request: Request) => {
  const idsParam = new URL(request.url).searchParams.get("ids")?.trim() ?? "";
  const ids = idsParam
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return jsonUtf8(
      { error: "Укажите ids карточек через ?ids=", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  if (ids.length > 50) {
    return jsonUtf8(
      { error: "Слишком много ids (максимум 50)", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const listings = [];
  for (const id of ids) {
    const listing = await getLongTermListingById(id);
    if (!listing) {
      return jsonUtf8(
        { error: `Карточка не найдена: ${id}`, code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    listings.push(listing);
  }

  const feed = prepareCianFeed(listings);
  const download = new URL(request.url).searchParams.get("download") === "1";

  if (download) {
    return new Response(feed.xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": 'attachment; filename="cian-feed-preview.xml"',
        "Cache-Control": "no-store",
      },
    });
  }

  return jsonUtf8({
    validCount: feed.validItems.length,
    invalidCount: feed.invalidItems.length,
    invalidItems: feed.invalidItems,
    warnings: feed.warnings,
    xml: feed.xml,
  });
});
