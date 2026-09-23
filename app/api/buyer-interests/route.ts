import type { BuyerInterestStatus } from "@prisma/client";
import { jsonUtf8 } from "@/lib/api-json";
import {
  BuyerInterestError,
  createBuyerInterest,
  getBuyerInterests,
  serializeBuyerInterest,
} from "@/lib/buyer-interests";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  BUYER_INTEREST_STATUSES,
  createBuyerInterestSchema,
  formatBuyerZodError,
} from "@/lib/validations/buyer";

function interestErrorResponse(error: unknown) {
  if (error instanceof BuyerInterestError) {
    const status = error.code === "CONFLICT" ? 409 : error.code === "NOT_FOUND" ? 404 : 400;
    return jsonUtf8(
      {
        error: error.message,
        ...(error.machineCode ? { code: error.machineCode } : {}),
      },
      { status },
    );
  }
  throw error;
}

export const GET = withApiAuth(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  if (status && !BUYER_INTEREST_STATUSES.includes(status as BuyerInterestStatus)) {
    return jsonUtf8({ error: "Некорректный статус" }, { status: 400 });
  }

  const interests = (
    await getBuyerInterests({
      buyerId: searchParams.get("buyerId") ?? undefined,
      saleListingId: searchParams.get("saleListingId") ?? undefined,
      status: (status as BuyerInterestStatus | null) ?? undefined,
    })
  ).map(serializeBuyerInterest);

  return jsonUtf8({ interests });
});

export const POST = withApiAuth(async (request: Request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonUtf8({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = createBuyerInterestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonUtf8(
      { error: "Ошибка валидации", details: formatBuyerZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const result = await createBuyerInterest(parsed.data);
    return jsonUtf8(
      { interest: serializeBuyerInterest(result.interest), created: result.created },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    return interestErrorResponse(error);
  }
});
