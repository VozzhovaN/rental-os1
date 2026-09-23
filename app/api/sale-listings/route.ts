import type { SaleListingStatus } from "@prisma/client";
import { jsonUtf8 } from "@/lib/api-json";
import {
  createSaleListing,
  getSaleListings,
  SaleListingError,
  serializeSaleListing,
} from "@/lib/sale-listings";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  SALE_LISTING_STATUSES,
  formatSaleListingZodError,
  parseCreateSaleListing,
} from "@/lib/validations/sale-listing";

function listingErrorResponse(error: unknown) {
  if (error instanceof SaleListingError) {
    const status = error.code === "CONFLICT" ? 409 : error.code === "NOT_FOUND" ? 404 : 400;
    return jsonUtf8({ error: error.message }, { status });
  }

  throw error;
}

export const GET = withApiAuth(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const sort = searchParams.get("sort");

  if (status && !SALE_LISTING_STATUSES.includes(status as SaleListingStatus)) {
    return jsonUtf8({ error: "Некорректный статус" }, { status: 400 });
  }

  const listings = (
    await getSaleListings({
      q: searchParams.get("q") ?? undefined,
      status: (status as SaleListingStatus | null) ?? undefined,
      sort: sort === "price" || sort === "name" ? sort : "updatedAt",
    })
  ).map(serializeSaleListing);

  return jsonUtf8({ listings });
});

export const POST = withApiAuth(async (request: Request) => {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonUtf8({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = parseCreateSaleListing(body);

  if (!parsed.success) {
    return jsonUtf8(
      { error: "Ошибка валидации", details: formatSaleListingZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const result = await createSaleListing(parsed.data);
    return jsonUtf8(
      { listing: serializeSaleListing(result.listing), created: result.created },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    return listingErrorResponse(error);
  }
});
