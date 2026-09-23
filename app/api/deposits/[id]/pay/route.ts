import { jsonUtf8 } from "@/lib/api-json";
import { DepositError, payDeposit, serializeDeposit } from "@/lib/deposits";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const POST = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  try {
    const deposit = await payDeposit(id);
    return jsonUtf8({ deposit: serializeDeposit(deposit) });
  } catch (error) {
    if (error instanceof DepositError) {
      const status = error.code === "CONFLICT" ? 409 : error.code === "NOT_FOUND" ? 404 : 400;
      return jsonUtf8(
        {
          error: error.message,
          ...(error.machineCode ? { code: error.machineCode } : {}),
        },
        { status },
      );
    }
    throw error;
  }
});
