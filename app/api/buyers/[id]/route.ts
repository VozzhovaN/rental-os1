import { jsonUtf8 } from "@/lib/api-json";
import {
  BuyerError,
  getBuyerById,
  serializeBuyer,
  updateBuyer,
} from "@/lib/buyers";
import { formatBuyerZodError, updateBuyerSchema } from "@/lib/validations/buyer";
import { withApiAuth } from "@/lib/auth/with-api-auth";

function buyerErrorResponse(error: unknown) {
  if (error instanceof BuyerError) {
    const status = error.code === "CONFLICT" ? 409 : error.code === "NOT_FOUND" ? 404 : 400;
    return jsonUtf8({ error: error.message }, { status });
  }
  throw error;
}

export const GET = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const buyer = await getBuyerById(id);
  if (!buyer) {
    return jsonUtf8({ error: "Клиент не найден" }, { status: 404 });
  }
  return jsonUtf8({ buyer: serializeBuyer(buyer) });
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

  const parsed = updateBuyerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonUtf8(
      { error: "Ошибка валидации", details: formatBuyerZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const buyer = await updateBuyer(id, parsed.data);
    return jsonUtf8({ buyer: serializeBuyer(buyer) });
  } catch (error) {
    return buyerErrorResponse(error);
  }
});
