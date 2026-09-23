import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  FinanceDomainError,
  createExpenseSchema,
  createManualExpense,
  serializeFinancialTransaction,
} from "@/lib/finance";
import { formatZodError } from "@/lib/validations/property";

export const POST = withApiAuth(async (request: Request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Некорректный JSON", 400, { code: "VALIDATION_ERROR" });
  }

  const parsed = createExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }

  try {
    const row = await createManualExpense(parsed.data);
    return jsonUtf8({ transaction: serializeFinancialTransaction(row) }, { status: 201 });
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
