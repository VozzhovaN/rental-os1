import { NextResponse } from "next/server";
import {
  ChannelListingError,
  createChannelListing,
  getPropertyChannelListings,
  serializeChannelListing,
} from "@/lib/channel-listings";
import { getPropertyByIdOrSlug } from "@/lib/properties";
import { createChannelListingSchema } from "@/lib/validations/channel-listing";
import { formatZodError } from "@/lib/validations/property";
import { withApiAuth } from "@/lib/auth/with-api-auth";

function listingErrorResponse(error: unknown) {
  if (error instanceof ChannelListingError) {
    const status =
      error.code === "CONFLICT"
        ? 409
        : error.code === "CHANNEL_INACTIVE"
          ? 400
          : 404;

    return NextResponse.json({ error: error.message }, { status });
  }

  throw error;
}

export const GET = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const property = await getPropertyByIdOrSlug(id);

  if (!property) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  const listings = (await getPropertyChannelListings(property.id)).map(
    serializeChannelListing,
  );

  return NextResponse.json({ listings });
});

export const POST = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const property = await getPropertyByIdOrSlug(id);

  if (!property) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = createChannelListingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка валидации", details: formatZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const listing = await createChannelListing(property.id, parsed.data);
    return NextResponse.json({ listing: serializeChannelListing(listing) }, { status: 201 });
  } catch (error) {
    return listingErrorResponse(error);
  }
});
