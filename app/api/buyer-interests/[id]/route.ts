import { jsonUtf8 } from "@/lib/api-json";
import {
  BuyerInterestError,
  getBuyerInterestById,
  serializeBuyerInterest,
  updateBuyerInterest,
} from "@/lib/buyer-interests";
import { formatBuyerZodError, updateBuyerInterestSchema } from "@/lib/validations/buyer";
import { withApiAuth } from "@/lib/auth/with-api-auth";

function interestErrorResponse(error: unknown) {
  if (error instanceof BuyerInterestError) {
    const status = error.code === "CONFLICT" ? 409 : error.code === "NOT_FOUND" ? 404 : 400;
    return jsonUtf8({ error: error.message }, { status });
  }
  throw error;
}

export const GET = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const interest = await getBuyerInterestById(id);
  if (!interest) {
    return jsonUtf8({ error: "Интерес не найден" }, { status: 404 });
  }
  return jsonUtf8({ interest: serializeBuyerInterest(interest) });
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

  const parsed = updateBuyerInterestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonUtf8(
      { error: "Ошибка валидации", details: formatBuyerZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const interest = await updateBuyerInterest(id, parsed.data);
    return jsonUtf8({ interest: serializeBuyerInterest(interest) });
  } catch (error) {
    return interestErrorResponse(error);
  }
});
