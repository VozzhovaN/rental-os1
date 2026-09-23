import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  FinanceDomainError,
  createOwnerSettlement,
  createOwnerSettlementSchema,
  listOwnerSettlements,
} from "@/lib/finance";
import { formatZodError } from "@/lib/validations/property";

type Ctx = { params: Promise<{ id: string }> };

function financeErrorResponse(error: FinanceDomainError) {
  const status = error.code === "NOT_FOUND" ? 404 : 400;
  return jsonError(error.message, status, {
    code: error.code === "NOT_FOUND" ? "NOT_FOUND" : "VALIDATION_ERROR",
  });
}

function serializeSettlement(
  settlement: Awaited<ReturnType<typeof listOwnerSettlements>>[number],
) {
  return {
    ...settlement,
    periodStart: settlement.periodStart.toISOString(),
    periodEnd: settlement.periodEnd.toISOString(),
    createdAt: settlement.createdAt.toISOString(),
    closedAt: settlement.closedAt?.toISOString() ?? null,
  };
}

export const GET = withApiAuth(async (_request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  try {
    const settlements = (await listOwnerSettlements(id)).map(serializeSettlement);
    return jsonUtf8({ settlements });
  } catch (error) {
    if (error instanceof FinanceDomainError) return financeErrorResponse(error);
    throw error;
  }
});

export const POST = withApiAuth(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Некорректный JSON", 400, { code: "VALIDATION_ERROR" });
  }

  const parsed = createOwnerSettlementSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }

  try {
    const settlement = await createOwnerSettlement(id, parsed.data);
    return jsonUtf8({ settlement: serializeSettlement(settlement) }, { status: 201 });
  } catch (error) {
    if (error instanceof FinanceDomainError) return financeErrorResponse(error);
    throw error;
  }
});
