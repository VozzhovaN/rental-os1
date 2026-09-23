import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import { FinanceDomainError } from "@/lib/finance";
import {
  createLongTermContract,
  listLongTermContracts,
} from "@/lib/finance/long-term-finance";
import { createLongTermContractSchema } from "@/lib/finance/long-term-finance-validation";
import { formatZodError } from "@/lib/validations/property";

function financeError(error: FinanceDomainError) {
  const status =
    error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : error.code === "FORBIDDEN" ? 403 : 400;
  const code =
    error.code === "NOT_FOUND"
      ? "NOT_FOUND"
      : error.code === "CONFLICT"
        ? "CONFLICT"
        : error.code === "FORBIDDEN"
          ? "FORBIDDEN"
          : "VALIDATION_ERROR";
  return jsonError(error.message, status, { code });
}

export const GET = withApiAuth(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  const propertyId = searchParams.get("propertyId") || undefined;
  const contracts = await listLongTermContracts({ status, propertyId });
  return jsonUtf8({ contracts });
});

export const POST = withApiAuth(async (request: Request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Некорректный JSON", 400, { code: "VALIDATION_ERROR" });
  }
  const parsed = createLongTermContractSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }
  try {
    const contract = await createLongTermContract(parsed.data);
    return jsonUtf8({ contract }, { status: 201 });
  } catch (error) {
    if (error instanceof FinanceDomainError) return financeError(error);
    throw error;
  }
});
