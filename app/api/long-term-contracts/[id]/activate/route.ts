import { jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import { FinanceDomainError } from "@/lib/finance";
import { activateLongTermContract } from "@/lib/finance/long-term-finance";
import { jsonError } from "@/lib/api-json";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withApiAuth(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  try {
    const contract = await activateLongTermContract(id);
    return jsonUtf8({ contract });
  } catch (error) {
    if (error instanceof FinanceDomainError) {
      const status =
        error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400;
      return jsonError(error.message, status, {
        code: error.code === "NOT_FOUND" ? "NOT_FOUND" : error.code === "CONFLICT" ? "CONFLICT" : "VALIDATION_ERROR",
      });
    }
    throw error;
  }
});
