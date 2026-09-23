import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import { FinanceDomainError } from "@/lib/finance";
import { endLongTermContract } from "@/lib/finance/long-term-finance";
import { z } from "zod";
import { formatZodError } from "@/lib/validations/property";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .transform((v) => (v ? new Date(`${v}T12:00:00.000Z`) : undefined)),
  })
  .strict();

export const POST = withApiAuth(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }
  try {
    const contract = await endLongTermContract(id, parsed.data.endDate);
    return jsonUtf8({ contract });
  } catch (error) {
    if (error instanceof FinanceDomainError) {
      return jsonError(error.message, error.code === "NOT_FOUND" ? 404 : 400, {
        code: error.code === "NOT_FOUND" ? "NOT_FOUND" : "VALIDATION_ERROR",
      });
    }
    throw error;
  }
});
