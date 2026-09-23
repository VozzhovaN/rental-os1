import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  FinanceDomainError,
  createCommissionPayment,
  createCommissionPaymentSchema,
  listCommissionPayments,
  listCommissionPaymentsQuerySchema,
} from "@/lib/finance";
import { formatZodError } from "@/lib/validations/property";

export const GET = withApiAuth(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const parsed = listCommissionPaymentsQuerySchema.safeParse({
    propertyId: searchParams.get("propertyId") || undefined,
    bookingId: searchParams.get("bookingId") || undefined,
    longTermContractId: searchParams.get("longTermContractId") || undefined,
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
  });

  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }

  const payments = await listCommissionPayments(parsed.data);
  return jsonUtf8({ payments });
});

export const POST = withApiAuth(async (request: Request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Некорректный JSON", 400, { code: "VALIDATION_ERROR" });
  }

  const parsed = createCommissionPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }

  try {
    const payment = await createCommissionPayment(parsed.data);
    return jsonUtf8({ payment }, { status: 201 });
  } catch (error) {
    if (error instanceof FinanceDomainError) {
      const status =
        error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400;
      return jsonError(error.message, status, {
        code:
          error.code === "NOT_FOUND"
            ? "NOT_FOUND"
            : error.code === "CONFLICT"
              ? "CONFLICT"
              : "VALIDATION_ERROR",
      });
    }
    throw error;
  }
});
