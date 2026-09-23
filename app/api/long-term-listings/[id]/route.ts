import { jsonUtf8 } from "@/lib/api-json";
import {
  archiveLongTermListing,
  getLongTermListingById,
  LongTermListingError,
  serializeLongTermListing,
  updateLongTermListing,
} from "@/lib/long-term-listings";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  formatLongTermListingZodError,
  parseUpdateLongTermListing,
} from "@/lib/validations/long-term-listing";

function listingErrorResponse(error: unknown) {
  if (error instanceof LongTermListingError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400;
    return jsonUtf8({ error: error.message }, { status });
  }

  throw error;
}

export const GET = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const listing = await getLongTermListingById(id);

  if (!listing) {
    return jsonUtf8({ error: "Карточка долгосрочной аренды не найдена" }, { status: 404 });
  }

  return jsonUtf8({ listing: serializeLongTermListing(listing) });
});

export const PATCH = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonUtf8({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = parseUpdateLongTermListing(body);

  if (!parsed.success) {
    return jsonUtf8(
      { error: "Ошибка валидации", details: formatLongTermListingZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const listing = await updateLongTermListing(id, parsed.data);
    return jsonUtf8({ listing: serializeLongTermListing(listing) });
  } catch (error) {
    return listingErrorResponse(error);
  }
});

export const DELETE = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;

  try {
    const listing = await archiveLongTermListing(id);
    return jsonUtf8({ listing: serializeLongTermListing(listing) });
  } catch (error) {
    return listingErrorResponse(error);
  }
});
