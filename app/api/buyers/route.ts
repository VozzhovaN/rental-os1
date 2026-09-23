import { jsonUtf8 } from "@/lib/api-json";
import {
  BuyerError,
  createBuyer,
  getBuyers,
  serializeBuyer,
  serializeBuyerListItem,
} from "@/lib/buyers";
import { createBuyerSchema, formatBuyerZodError } from "@/lib/validations/buyer";
import { withApiAuth } from "@/lib/auth/with-api-auth";

function buyerErrorResponse(error: unknown) {
  if (error instanceof BuyerError) {
    const status = error.code === "CONFLICT" ? 409 : error.code === "NOT_FOUND" ? 404 : 400;
    return jsonUtf8({ error: error.message }, { status });
  }
  throw error;
}

export const GET = withApiAuth(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const buyers = (await getBuyers({ q: searchParams.get("q") ?? undefined })).map(
    serializeBuyerListItem,
  );
  return jsonUtf8({ buyers });
});

export const POST = withApiAuth(async (request: Request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonUtf8({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = createBuyerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonUtf8(
      { error: "Ошибка валидации", details: formatBuyerZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const buyer = await createBuyer(parsed.data);
    return jsonUtf8({ buyer: serializeBuyer(buyer) }, { status: 201 });
  } catch (error) {
    return buyerErrorResponse(error);
  }
});
