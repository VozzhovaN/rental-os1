import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import { FinanceDomainError } from "@/lib/finance";
import { generateLongTermCharges } from "@/lib/finance/long-term-finance";
import { generateChargesSchema } from "@/lib/finance/long-term-finance-validation";
import { formatZodError } from "@/lib/validations/property";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withApiAuth(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = generateChargesSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }
  try {
    const result = await generateLongTermCharges(id, parsed.data);
    return jsonUtf8(result, { status: 201 });
  } catch (error) {
    if (error instanceof FinanceDomainError) {
      return jsonError(error.message, error.code === "NOT_FOUND" ? 404 : 400, {
        code: error.code === "NOT_FOUND" ? "NOT_FOUND" : "VALIDATION_ERROR",
      });
    }
    throw error;
  }
});
