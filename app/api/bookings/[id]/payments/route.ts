import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  FinanceDomainError,
  getBookingFinanceState,
  recordBookingPayment,
  recordBookingPaymentSchema,
} from "@/lib/finance";
import { formatZodError } from "@/lib/validations/property";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withApiAuth(async (_request: Request, context: RouteContext) => {
  const { id } = await context.params;
  try {
    const finance = await getBookingFinanceState(id);
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

export const POST = withApiAuth(async (request: Request, context: RouteContext) => {
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Некорректный JSON", 400, { code: "VALIDATION_ERROR" });
  }

  const parsed = recordBookingPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }

  try {
    const payment = await recordBookingPayment(id, parsed.data);
    const finance = await getBookingFinanceState(id);
    return jsonUtf8({ payment: { id: payment.id }, finance }, { status: 201 });
  } catch (error) {
    if (error instanceof FinanceDomainError) {
      const status =
        error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400;
      return jsonError(error.message, status, {
        code:
          error.code === "NOT_FOUND"
            ? "NOT_FOUND"
            : error.code === "CONFLICT"
              ? "CONFLICT"
              : "VALIDATION_ERROR",
      });
    }
    throw error;
  }
});
