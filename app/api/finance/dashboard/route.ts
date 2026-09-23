import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import { FinanceDomainError, getFinanceDashboard } from "@/lib/finance";

export const GET = withApiAuth(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const rawQuery = {
    period: searchParams.get("period") || undefined,
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
    propertyId: searchParams.get("propertyId") || undefined,
    managementType: searchParams.get("managementType") || undefined,
    segment: searchParams.get("segment") || undefined,
  };

  try {
    const dashboard = await getFinanceDashboard(rawQuery);
    return jsonUtf8({ dashboard });
  } catch (error) {
    if (error instanceof FinanceDomainError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return jsonError(error.message, status, {
        code: error.code === "NOT_FOUND" ? "NOT_FOUND" : "VALIDATION_ERROR",
      });
    }
    throw error;
  }
});
