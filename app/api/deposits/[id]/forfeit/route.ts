import { jsonUtf8 } from "@/lib/api-json";
import { DepositError, forfeitDeposit, serializeDeposit } from "@/lib/deposits";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const POST = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  try {
    const deposit = await forfeitDeposit(id);
    return jsonUtf8({ deposit: serializeDeposit(deposit) });
  } catch (error) {
    if (error instanceof DepositError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return jsonUtf8({ error: error.message }, { status });
    }
    throw error;
  }
});
