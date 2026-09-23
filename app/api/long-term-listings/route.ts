import type { LongTermListingStatus } from "@prisma/client";
import { jsonUtf8 } from "@/lib/api-json";
import {
  createLongTermListing,
  getLongTermListings,
  LongTermListingError,
  serializeLongTermListing,
} from "@/lib/long-term-listings";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  LONG_TERM_STATUSES,
  formatLongTermListingZodError,
  parseCreateLongTermListing,
} from "@/lib/validations/long-term-listing";

function listingErrorResponse(error: unknown) {
  if (error instanceof LongTermListingError) {
    const status = error.code === "CONFLICT" ? 409 : error.code === "NOT_FOUND" ? 404 : 400;
    return jsonUtf8({ error: error.message }, { status });
  }

  throw error;
}

export const GET = withApiAuth(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const sort = searchParams.get("sort");

  if (status && !LONG_TERM_STATUSES.includes(status as LongTermListingStatus)) {
    return jsonUtf8({ error: "Некорректный статус" }, { status: 400 });
  }

  const listings = (
    await getLongTermListings({
      q: searchParams.get("q") ?? undefined,
      status: (status as LongTermListingStatus | null) ?? undefined,
      sort: sort === "monthlyPrice" || sort === "name" ? sort : "updatedAt",
    })
  ).map(serializeLongTermListing);

  return jsonUtf8({ listings });
});

export const POST = withApiAuth(async (request: Request) => {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonUtf8({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = parseCreateLongTermListing(body);

  if (!parsed.success) {
    return jsonUtf8(
      { error: "Ошибка валидации", details: formatLongTermListingZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const result = await createLongTermListing(parsed.data);
    return jsonUtf8(
      { listing: serializeLongTermListing(result.listing), created: result.created },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    return listingErrorResponse(error);
  }
});
