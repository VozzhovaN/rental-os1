import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import { FinanceDomainError, getBookingFinanceState } from "@/lib/finance";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withApiAuth(async (_request: Request, context: RouteContext) => {
  const { id } = await context.params;
  try {
    const finance = await getBookingFinanceState(id);
    return jsonUtf8({ finance });
  } catch (error) {
    if (error instanceof FinanceDomainError) {
      return jsonError(error.message, error.code === "NOT_FOUND" ? 404 : 400, {
        code: error.code === "NOT_FOUND" ? "NOT_FOUND" : "VALIDATION_ERROR",
      });
    }
    throw error;
  }
});
