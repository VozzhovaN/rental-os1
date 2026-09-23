import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  FinanceDomainError,
  getFinanceSummary,
  listFinanceQuerySchema,
  listFinancialTransactions,
} from "@/lib/finance";
import { formatZodError } from "@/lib/validations/property";

export const GET = withApiAuth(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const parsed = listFinanceQuerySchema.safeParse({
    propertyId: searchParams.get("propertyId") || undefined,
    type: searchParams.get("type") || undefined,
    category: searchParams.get("category") || undefined,
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
    const [transactions, summary] = await Promise.all([
      listFinancialTransactions(parsed.data),
      getFinanceSummary(parsed.data),
    ]);
    return jsonUtf8({ transactions, summary });
  } catch (error) {
    if (error instanceof FinanceDomainError) {
      return jsonError(error.message, error.code === "NOT_FOUND" ? 404 : 400, {
        code: error.code === "NOT_FOUND" ? "NOT_FOUND" : "VALIDATION_ERROR",
      });
    }
    throw error;
  }
});
