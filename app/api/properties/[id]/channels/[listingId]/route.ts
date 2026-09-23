import { NextResponse } from "next/server";
import {
  ChannelListingError,
  deleteChannelListing,
  getPropertyChannelListing,
  serializeChannelListing,
  updateChannelListing,
} from "@/lib/channel-listings";
import { getPropertyByIdOrSlug } from "@/lib/properties";
import { updateChannelListingSchema } from "@/lib/validations/channel-listing";
import { formatZodError } from "@/lib/validations/property";
import { withApiAuth } from "@/lib/auth/with-api-auth";

function listingErrorResponse(error: unknown): NextResponse {
  if (error instanceof ChannelListingError) {
    const status = error.code === "CONFLICT" ? 409 : 404;
    return NextResponse.json({ error: error.message }, { status });
  }

  throw error;
}

type ResolvedContext =
  | { ok: false; response: NextResponse }
  | { ok: true; property: NonNullable<Awaited<ReturnType<typeof getPropertyByIdOrSlug>>>; listingId: string };

async function resolveContext(
  params: Promise<{ id: string; listingId: string }>,
): Promise<ResolvedContext> {
  const { id, listingId } = await params;
  const property = await getPropertyByIdOrSlug(id);

  if (!property) {
    return { ok: false, response: NextResponse.json({ error: "Объект не найден" }, { status: 404 }) };
  }

  return { ok: true, property, listingId };
}

export const GET = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string; listingId: string }> },) => {
  const resolved = await resolveContext(context.params);

  if (!resolved.ok) {
    return resolved.response;
  }

  const listing = await getPropertyChannelListing(resolved.property.id, resolved.listingId);

  if (!listing) {
    return NextResponse.json({ error: "Привязка не найдена" }, { status: 404 });
  }

  return NextResponse.json({ listing: serializeChannelListing(listing) });
});

export const PATCH = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string; listingId: string }> },) => {
  const resolved = await resolveContext(context.params);

  if (!resolved.ok) {
    return resolved.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = updateChannelListingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка валидации", details: formatZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const listing = await updateChannelListing(
      resolved.property.id,
      resolved.listingId,
      parsed.data,
    );
    return NextResponse.json({ listing: serializeChannelListing(listing) });
  } catch (error) {
    return listingErrorResponse(error);
  }
});

export const DELETE = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string; listingId: string }> },) => {
  const resolved = await resolveContext(context.params);

  if (!resolved.ok) {
    return resolved.response;
  }

  try {
    await deleteChannelListing(resolved.property.id, resolved.listingId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return listingErrorResponse(error);
  }
});
