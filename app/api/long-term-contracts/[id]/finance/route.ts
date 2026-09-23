import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import { FinanceDomainError } from "@/lib/finance";
import { getContractFinanceSummary } from "@/lib/finance/long-term-finance";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApiAuth(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  try {
    const finance = await getContractFinanceSummary(id);
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
