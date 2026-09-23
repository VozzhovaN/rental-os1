import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  FinanceDomainError,
  createOwnerPayout,
  createOwnerPayoutSchema,
  listOwnerPayouts,
} from "@/lib/finance";
import { formatZodError } from "@/lib/validations/property";

type Ctx = { params: Promise<{ id: string }> };

function financeErrorResponse(error: FinanceDomainError) {
  const status = error.code === "NOT_FOUND" ? 404 : 400;
  return jsonError(error.message, status, {
    code: error.code === "NOT_FOUND" ? "NOT_FOUND" : "VALIDATION_ERROR",
  });
}

function serializePayout(
  payout: {
    id: string;
    amount: number;
    paidAt: Date;
    method: string | null;
    note: string | null;
    createdAt: Date;
    allocations: Array<{
      id: string;
      amount: number;
      property?: { id: string; name: string };
      propertyId?: string;
    }>;
  },
) {
  return {
    id: payout.id,
    amount: payout.amount,
    paidAt: payout.paidAt.toISOString(),
    method: payout.method,
    note: payout.note,
    createdAt: payout.createdAt.toISOString(),
    allocations: payout.allocations.map((a) => ({
      id: a.id,
      amount: a.amount,
      property: a.property ?? { id: a.propertyId ?? "", name: "" },
    })),
  };
}

export const GET = withApiAuth(async (_request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  try {
    const payouts = (await listOwnerPayouts(id)).map(serializePayout);
    return jsonUtf8({ payouts });
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

  const parsed = createOwnerPayoutSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }

  try {
    const result = await createOwnerPayout(id, parsed.data);
    return jsonUtf8(
      {
        payout: serializePayout(result.payout),
        exceedsWarning: result.exceedsWarning,
        balanceDueBefore: result.balanceDueBefore,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof FinanceDomainError) return financeErrorResponse(error);
    throw error;
  }
});
