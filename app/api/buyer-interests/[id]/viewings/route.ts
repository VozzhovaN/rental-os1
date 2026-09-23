import { jsonUtf8 } from "@/lib/api-json";
import {
  getViewingsByInterest,
  scheduleViewing,
  serializeViewing,
  ViewingError,
} from "@/lib/viewings";
import {
  createViewingSchema,
  formatViewingDepositZodError,
} from "@/lib/validations/viewing-deposit";
import { prisma } from "@/lib/prisma";
import { withApiAuth } from "@/lib/auth/with-api-auth";

function viewingErrorResponse(error: unknown) {
  if (error instanceof ViewingError) {
    const status = error.code === "CONFLICT" ? 409 : error.code === "NOT_FOUND" ? 404 : 400;
    return jsonUtf8({ error: error.message }, { status });
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
  const viewings = (await getViewingsByInterest(id)).map(serializeViewing);
  return jsonUtf8({ viewings });
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

  const parsed = createViewingSchema.safeParse(body);
  if (!parsed.success) {
    return jsonUtf8(
      { error: "Ошибка валидации", details: formatViewingDepositZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const viewing = await scheduleViewing(id, parsed.data);
    return jsonUtf8({ viewing: serializeViewing(viewing) }, { status: 201 });
  } catch (error) {
    return viewingErrorResponse(error);
  }
});
