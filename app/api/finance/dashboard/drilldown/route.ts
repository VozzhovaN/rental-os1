import { z } from "zod";
import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  FinanceDomainError,
  getFinanceDashboardDrilldown,
  getPropertyExpenseCategoriesDrilldown,
  FINANCE_MANAGEMENT_FILTERS,
} from "@/lib/finance";
import { formatZodError } from "@/lib/validations/property";

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату ГГГГ-ММ-ДД");

const drilldownQuerySchema = z
  .object({
    kind: z.enum(["profit", "expense"]),
    segment: z.enum(["SHORT_TERM", "LONG_TERM", "GENERAL"]),
    dateFrom: isoDate,
    dateTo: isoDate,
    propertyId: z.string().trim().min(1).optional(),
    managementType: z.enum(FINANCE_MANAGEMENT_FILTERS).optional().default("ALL"),
    level: z.enum(["property", "category"]).optional().default("property"),
  })
  .strict();

export const GET = withApiAuth(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const parsed = drilldownQuerySchema.safeParse({
    kind: searchParams.get("kind") || undefined,
    segment: searchParams.get("segment") || undefined,
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
    propertyId: searchParams.get("propertyId") || undefined,
    managementType: searchParams.get("managementType") || undefined,
    level: searchParams.get("level") || undefined,
  });

  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }

  const { kind, segment, dateFrom, dateTo, propertyId, managementType, level } = parsed.data;

  try {
    if (level === "category" && propertyId) {
      const result = await getPropertyExpenseCategoriesDrilldown({
        propertyId,
        dateFrom,
        dateTo,
      });
      return jsonUtf8({ drilldown: result });
    }

    const drilldown = await getFinanceDashboardDrilldown({
      kind,
      segment,
      dateFrom,
      dateTo,
      propertyId,
      managementType,
    });
    return jsonUtf8({ drilldown });
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
