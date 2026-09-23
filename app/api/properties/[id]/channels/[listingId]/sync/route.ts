import { NextResponse } from "next/server";
import { syncListing } from "@/lib/integrations/avito-service";
import { integrationErrorResponse } from "@/lib/integrations/errors";
import { getPropertyChannelListing } from "@/lib/channel-listings";
import { getPropertyByIdOrSlug } from "@/lib/properties";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const POST = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string; listingId: string }> },) => {
  const { id, listingId } = await context.params;
  const property = await getPropertyByIdOrSlug(id);

  if (!property) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  const listing = await getPropertyChannelListing(property.id, listingId);

  if (!listing) {
    return NextResponse.json({ error: "Привязка не найдена" }, { status: 404 });
  }

  if (listing.salesChannel.code !== "AVITO") {
    return NextResponse.json(
      { error: "Синхронизация API доступна только для Авито." },
      { status: 400 },
    );
  }

  try {
    const result = await syncListing(property.id, listing.id);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return integrationErrorResponse(error);
  }
});
