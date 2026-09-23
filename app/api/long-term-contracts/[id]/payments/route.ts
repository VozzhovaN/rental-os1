import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import { FinanceDomainError } from "@/lib/finance";
import {
  getContractFinanceSummary,
  recordLongTermPayment,
} from "@/lib/finance/long-term-finance";
import { recordLongTermPaymentSchema } from "@/lib/finance/long-term-finance-validation";
import { formatZodError } from "@/lib/validations/property";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApiAuth(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  try {
    const finance = await getContractFinanceSummary(id);
    return jsonUtf8({ payments: finance.payments });
  } catch (error) {
    if (error instanceof FinanceDomainError) {
      return jsonError(error.message, error.code === "NOT_FOUND" ? 404 : 400, {
        code: error.code === "NOT_FOUND" ? "NOT_FOUND" : "VALIDATION_ERROR",
      });
    }
    throw error;
  }
});

export const POST = withApiAuth(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Некорректный JSON", 400, { code: "VALIDATION_ERROR" });
  }
  const parsed = recordLongTermPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }
  try {
    const payment = await recordLongTermPayment(id, parsed.data);
    const finance = await getContractFinanceSummary(id);
    return jsonUtf8({ payment: { id: payment.id }, finance }, { status: 201 });
  } catch (error) {
    if (error instanceof FinanceDomainError) {
      return jsonError(error.message, error.code === "NOT_FOUND" ? 404 : 400, {
        code: error.code === "NOT_FOUND" ? "NOT_FOUND" : "VALIDATION_ERROR",
      });
    }
    throw error;
  }
});
