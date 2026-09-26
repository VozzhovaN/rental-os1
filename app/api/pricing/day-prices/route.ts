import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import { parseDateOnly } from "@/lib/format";
import {
  PricingDomainError,
  getDayPriceData,
  setDayPriceRange,
  setDayPriceRangeSchema,
} from "@/lib/pricing/day-prices";
import { prisma } from "@/lib/prisma";
import { formatZodError } from "@/lib/validations/property";

export const dynamic = "force-dynamic";

export const GET = withApiAuth(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const propertyId = searchParams.get("propertyId")?.trim() || undefined;

  if (!parseDateOnly(dateFrom) || !parseDateOnly(dateTo)) {
    return jsonError("Укажите dateFrom и dateTo (ГГГГ-ММ-ДД)", 400, {
      code: "VALIDATION_ERROR",
    });
  }

  const propertyIds = propertyId
    ? [propertyId]
    : (
        await prisma.property.findMany({ select: { id: true } })
      ).map((p) => p.id);

  const data = await getDayPriceData({ propertyIds, dateFrom, dateTo });
  return jsonUtf8({ data });
});

export const PUT = withApiAuth(async (request: Request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Некорректный JSON", 400, { code: "VALIDATION_ERROR" });
  }

  const parsed = setDayPriceRangeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }

  try {
    const result = await setDayPriceRange(parsed.data);
    return jsonUtf8(result);
  } catch (error) {
    if (error instanceof PricingDomainError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return jsonError(error.message, status, {
        code: error.code === "NOT_FOUND" ? "NOT_FOUND" : "VALIDATION_ERROR",
      });
    }
    throw error;
  }
});
