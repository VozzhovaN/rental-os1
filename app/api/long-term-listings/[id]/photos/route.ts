import { jsonUtf8 } from "@/lib/api-json";
import {
  getLongTermListingById,
  LongTermListingError,
  replaceLongTermPhotos,
  serializeLongTermListing,
} from "@/lib/long-term-listings";
import { formatLongTermListingZodError, longTermPhotosSchema } from "@/lib/validations/long-term-listing";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const GET = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const listing = await getLongTermListingById(id);

  if (!listing) {
    return jsonUtf8({ error: "Карточка долгосрочной аренды не найдена" }, { status: 404 });
  }

  return jsonUtf8({ listing: serializeLongTermListing(listing) });
});

export const PUT = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonUtf8({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = longTermPhotosSchema.safeParse(body);

  if (!parsed.success) {
    return jsonUtf8(
      { error: "Ошибка валидации", details: formatLongTermListingZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const listing = await replaceLongTermPhotos(id, parsed.data);
    if (!listing) {
      return jsonUtf8({ error: "Карточка долгосрочной аренды не найдена" }, { status: 404 });
    }
    return jsonUtf8({ listing: serializeLongTermListing(listing) });
  } catch (error) {
    if (error instanceof LongTermListingError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return jsonUtf8({ error: error.message }, { status });
    }
    throw error;
  }
});
