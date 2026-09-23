import { jsonUtf8 } from "@/lib/api-json";
import { listBuyerHistory, recordBuyerHistory, serializeBuyerHistory } from "@/lib/buyer-history";
import { prisma } from "@/lib/prisma";
import { createBuyerHistoryNoteSchema } from "@/lib/validations/buyer-history";
import { formatViewingDepositZodError } from "@/lib/validations/viewing-deposit";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const GET = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const buyer = await prisma.buyer.findUnique({ where: { id } });
  if (!buyer) {
    return jsonUtf8({ error: "Клиент не найден" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const history = (
    await listBuyerHistory(id, {
      buyerInterestId: searchParams.get("buyerInterestId") ?? undefined,
    })
  ).map(serializeBuyerHistory);

  return jsonUtf8({ history });
});

export const POST = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const buyer = await prisma.buyer.findUnique({ where: { id } });
  if (!buyer) {
    return jsonUtf8({ error: "Клиент не найден" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonUtf8({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = createBuyerHistoryNoteSchema.safeParse(body);
  if (!parsed.success) {
    return jsonUtf8(
      { error: "Ошибка валидации", details: formatViewingDepositZodError(parsed.error) },
      { status: 400 },
    );
  }

  const entry = await recordBuyerHistory({
    buyerId: id,
    type: "NOTE",
    message: parsed.data.message,
  });

  return jsonUtf8({ entry: serializeBuyerHistory(entry) }, { status: 201 });
});
