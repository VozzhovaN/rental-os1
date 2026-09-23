import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import { FinanceDomainError } from "@/lib/finance";
import {
  getLongTermContract,
  updateLongTermContract,
} from "@/lib/finance/long-term-finance";
import { updateLongTermContractSchema } from "@/lib/finance/long-term-finance-validation";
import { formatZodError } from "@/lib/validations/property";

type Ctx = { params: Promise<{ id: string }> };

function financeError(error: FinanceDomainError) {
  const status =
    error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : error.code === "FORBIDDEN" ? 403 : 400;
  return jsonError(error.message, status, {
    code:
      error.code === "NOT_FOUND"
        ? "NOT_FOUND"
        : error.code === "CONFLICT"
          ? "CONFLICT"
          : error.code === "FORBIDDEN"
            ? "FORBIDDEN"
            : "VALIDATION_ERROR",
  });
}

export const GET = withApiAuth(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  try {
    const contract = await getLongTermContract(id);
    return jsonUtf8({ contract });
  } catch (error) {
    if (error instanceof FinanceDomainError) return financeError(error);
    throw error;
  }
});

export const PATCH = withApiAuth(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Некорректный JSON", 400, { code: "VALIDATION_ERROR" });
  }
  const parsed = updateLongTermContractSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }
  try {
    const contract = await updateLongTermContract(id, parsed.data);
    return jsonUtf8({ contract });
  } catch (error) {
    if (error instanceof FinanceDomainError) return financeError(error);
    throw error;
  }
});
