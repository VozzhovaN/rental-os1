import { jsonUtf8 } from "@/lib/api-json";
import { completePurchase, PurchaseError } from "@/lib/purchase";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const POST = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  try {
    const result = await completePurchase(id);
    return jsonUtf8({
      interest: result.interest,
      listing: result.listing,
      created: result.created,
    });
  } catch (error) {
    if (error instanceof PurchaseError) {
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
