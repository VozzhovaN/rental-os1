import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import { FinanceDomainError, getBookingCommissionSummary } from "@/lib/finance";
import { listFinanceQuerySchema } from "@/lib/finance/validation";
import { formatZodError } from "@/lib/validations/property";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withApiAuth(async (request: Request, context: RouteContext) => {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const parsed = listFinanceQuerySchema.safeParse({
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
  });

  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }

  try {
    const commission = await getBookingCommissionSummary(id, parsed.data);
    return jsonUtf8({ commission });
  } catch (error) {
    if (error instanceof FinanceDomainError) {
      return jsonError(error.message, error.code === "NOT_FOUND" ? 404 : 400, {
        code: error.code === "NOT_FOUND" ? "NOT_FOUND" : "VALIDATION_ERROR",
      });
    }
    throw error;
  }
});
