import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import { calculatePropertyEconomics } from "@/lib/finance";
import { listFinanceQuerySchema } from "@/lib/finance/validation";
import { formatZodError } from "@/lib/validations/property";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withApiAuth(async (request: Request, context: RouteContext) => {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const parsed = listFinanceQuerySchema.safeParse({
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
  });

  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }

  try {
    const economics = await calculatePropertyEconomics(id, parsed.data);
    return jsonUtf8({ economics });
  } catch (error) {
    if (error instanceof Error && error.message === "Property not found") {
      return jsonError("Объект не найден", 404, { code: "NOT_FOUND" });
    }
    throw error;
  }
});
