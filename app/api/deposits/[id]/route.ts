import { jsonUtf8 } from "@/lib/api-json";
import { getDepositById, serializeDeposit } from "@/lib/deposits";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const GET = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const deposit = await getDepositById(id);
  if (!deposit) {
    return jsonUtf8({ error: "Задаток не найден" }, { status: 404 });
  }
  return jsonUtf8({ deposit: serializeDeposit(deposit) });
});
