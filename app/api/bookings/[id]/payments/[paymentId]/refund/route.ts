import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  FinanceDomainError,
  getBookingFinanceState,
  recordBookingRefund,
  recordBookingRefundSchema,
} from "@/lib/finance";
import { formatZodError } from "@/lib/validations/property";

type RouteContext = { params: Promise<{ id: string; paymentId: string }> };

export const POST = withApiAuth(async (request: Request, context: RouteContext) => {
  const { id, paymentId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Некорректный JSON", 400, { code: "VALIDATION_ERROR" });
  }

  const parsed = recordBookingRefundSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }

  try {
    const refund = await recordBookingRefund(id, paymentId, parsed.data);
    const finance = await getBookingFinanceState(id);
    return jsonUtf8({ refund: { id: refund.id }, finance }, { status: 201 });
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
