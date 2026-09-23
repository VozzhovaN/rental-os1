import { jsonUtf8 } from "@/lib/api-json";
import {
  getSaleListingById,
  SaleListingError,
  replaceSaleListingPhotos,
  serializeSaleListing,
} from "@/lib/sale-listings";
import { formatSaleListingZodError, saleListingPhotosSchema } from "@/lib/validations/sale-listing";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const GET = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const listing = await getSaleListingById(id);

  if (!listing) {
    return jsonUtf8({ error: "Карточка продажи не найдена" }, { status: 404 });
  }

  return jsonUtf8({ listing: serializeSaleListing(listing) });
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

  const parsed = saleListingPhotosSchema.safeParse(body);

  if (!parsed.success) {
    return jsonUtf8(
      { error: "Ошибка валидации", details: formatSaleListingZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const listing = await replaceSaleListingPhotos(id, parsed.data);
    if (!listing) {
      return jsonUtf8({ error: "Карточка продажи не найдена" }, { status: 404 });
    }
    return jsonUtf8({ listing: serializeSaleListing(listing) });
  } catch (error) {
    if (error instanceof SaleListingError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return jsonUtf8({ error: error.message }, { status });
    }
    throw error;
  }
});
