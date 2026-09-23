import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import { FinanceDomainError, closeOwnerSettlement } from "@/lib/finance";

type Ctx = { params: Promise<{ id: string }> };

function financeErrorResponse(error: FinanceDomainError) {
  const status = error.code === "NOT_FOUND" ? 404 : 400;
  return jsonError(error.message, status, {
    code: error.code === "NOT_FOUND" ? "NOT_FOUND" : "VALIDATION_ERROR",
  });
}

export const POST = withApiAuth(async (_request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  try {
    const settlement = await closeOwnerSettlement(id);
    return jsonUtf8({
      settlement: {
        ...settlement,
        periodStart: settlement.periodStart.toISOString(),
        periodEnd: settlement.periodEnd.toISOString(),
        createdAt: settlement.createdAt.toISOString(),
        closedAt: settlement.closedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    if (error instanceof FinanceDomainError) return financeErrorResponse(error);
    throw error;
  }
});
