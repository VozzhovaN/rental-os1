import { jsonUtf8 } from "@/lib/api-json";
import {
  getDepositsByInterest,
  createDeposit,
  serializeDeposit,
  DepositError,
} from "@/lib/deposits";
import {
  createDepositSchema,
  formatViewingDepositZodError,
} from "@/lib/validations/viewing-deposit";
import { prisma } from "@/lib/prisma";
import { withApiAuth } from "@/lib/auth/with-api-auth";

function depositErrorResponse(error: unknown) {
  if (error instanceof DepositError) {
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

export const GET = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const interest = await prisma.buyerInterest.findUnique({ where: { id } });
  if (!interest) {
    return jsonUtf8({ error: "Интерес не найден" }, { status: 404 });
  }
  const deposits = (await getDepositsByInterest(id)).map(serializeDeposit);
  return jsonUtf8({ deposits });
});

export const POST = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonUtf8({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = createDepositSchema.safeParse(body);
  if (!parsed.success) {
    return jsonUtf8(
      { error: "Ошибка валидации", details: formatViewingDepositZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const deposit = await createDeposit(id, parsed.data);
    return jsonUtf8({ deposit: serializeDeposit(deposit) }, { status: 201 });
  } catch (error) {
    return depositErrorResponse(error);
  }
});
