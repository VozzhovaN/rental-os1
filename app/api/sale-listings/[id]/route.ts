import { jsonUtf8 } from "@/lib/api-json";
import {
  archiveSaleListing,
  getSaleListingById,
  SaleListingError,
  serializeSaleListing,
  updateSaleListing,
} from "@/lib/sale-listings";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  formatSaleListingZodError,
  parseUpdateSaleListing,
} from "@/lib/validations/sale-listing";

function listingErrorResponse(error: unknown) {
  if (error instanceof SaleListingError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400;
    return jsonUtf8({ error: error.message }, { status });
  }

  throw error;
}

export const GET = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const listing = await getSaleListingById(id);

  if (!listing) {
    return jsonUtf8({ error: "Карточка продажи не найдена" }, { status: 404 });
  }

  return jsonUtf8({ listing: serializeSaleListing(listing) });
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

  const parsed = parseUpdateSaleListing(body);

  if (!parsed.success) {
    return jsonUtf8(
      { error: "Ошибка валидации", details: formatSaleListingZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const listing = await updateSaleListing(id, parsed.data);
    return jsonUtf8({ listing: serializeSaleListing(listing) });
  } catch (error) {
    return listingErrorResponse(error);
  }
});

export const DELETE = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;

  try {
    const listing = await archiveSaleListing(id);
    return jsonUtf8({ listing: serializeSaleListing(listing) });
  } catch (error) {
    return listingErrorResponse(error);
  }
});
