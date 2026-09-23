import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  FinanceDomainError,
  getOwnerFinanceBundle,
  ownerFinanceQuerySchema,
} from "@/lib/finance";
import { formatZodError } from "@/lib/validations/property";

type Ctx = { params: Promise<{ id: string }> };

function financeErrorResponse(error: FinanceDomainError) {
  const status = error.code === "NOT_FOUND" ? 404 : 400;
  return jsonError(error.message, status, {
    code: error.code === "NOT_FOUND" ? "NOT_FOUND" : "VALIDATION_ERROR",
  });
}

export const GET = withApiAuth(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const parsed = ownerFinanceQuerySchema.safeParse({
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }

  try {
    const bundle = await getOwnerFinanceBundle(id, parsed.data);
    return jsonUtf8({
      owner: {
        ...bundle.owner,
        createdAt: bundle.owner.createdAt.toISOString(),
        updatedAt: bundle.owner.updatedAt.toISOString(),
      },
      balance: bundle.balance,
      payouts: bundle.payouts.map((p) => ({
        ...p,
        paidAt: p.paidAt.toISOString(),
        createdAt: p.createdAt.toISOString(),
      })),
      settlements: bundle.settlements.map((s) => ({
        ...s,
        periodStart: s.periodStart.toISOString(),
        periodEnd: s.periodEnd.toISOString(),
        createdAt: s.createdAt.toISOString(),
        closedAt: s.closedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof FinanceDomainError) return financeErrorResponse(error);
    throw error;
  }
});
