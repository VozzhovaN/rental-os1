import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import { FinanceDomainError } from "@/lib/finance";
import {
  createManualCharge,
  getContractFinanceSummary,
} from "@/lib/finance/long-term-finance";
import {
  createManualChargeSchema,
} from "@/lib/finance/long-term-finance-validation";
import { formatZodError } from "@/lib/validations/property";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApiAuth(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  try {
    const finance = await getContractFinanceSummary(id);
    return jsonUtf8({ charges: finance.charges });
  } catch (error) {
    if (error instanceof FinanceDomainError) {
      return jsonError(error.message, error.code === "NOT_FOUND" ? 404 : 400, {
        code: error.code === "NOT_FOUND" ? "NOT_FOUND" : "VALIDATION_ERROR",
      });
    }
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

  // Manual charge vs generate discriminated by presence of type
  if (body && typeof body === "object" && "type" in body) {
    const parsed = createManualChargeSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Ошибка валидации", 400, {
        code: "VALIDATION_ERROR",
        details: formatZodError(parsed.error),
      });
    }
    try {
      const charge = await createManualCharge(id, parsed.data);
      return jsonUtf8({ charge }, { status: 201 });
    } catch (error) {
      if (error instanceof FinanceDomainError) {
        return jsonError(error.message, error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400, {
          code: error.code === "NOT_FOUND" ? "NOT_FOUND" : error.code === "CONFLICT" ? "CONFLICT" : "VALIDATION_ERROR",
        });
      }
      throw error;
    }
  }

  return jsonError("Используйте POST .../charges/generate для генерации", 400, {
    code: "VALIDATION_ERROR",
  });
});
