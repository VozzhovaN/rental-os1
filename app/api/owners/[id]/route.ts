import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  FinanceDomainError,
  getOwner,
  updateOwner,
  updateOwnerSchema,
} from "@/lib/finance";
import { formatZodError } from "@/lib/validations/property";

type Ctx = { params: Promise<{ id: string }> };

function financeErrorResponse(error: FinanceDomainError) {
  const status =
    error.code === "NOT_FOUND"
      ? 404
      : error.code === "CONFLICT"
        ? 409
        : error.code === "FORBIDDEN"
          ? 403
          : 400;
  return jsonError(error.message, status, {
    code:
      error.code === "NOT_FOUND"
        ? "NOT_FOUND"
        : error.code === "CONFLICT"
          ? "CONFLICT"
          : error.code === "FORBIDDEN"
            ? "FORBIDDEN"
            : "VALIDATION_ERROR",
  });
}

function serializeOwnerDetail(owner: Awaited<ReturnType<typeof getOwner>>) {
  return {
    id: owner.id,
    name: owner.name,
    phone: owner.phone,
    email: owner.email,
    notes: owner.notes,
    isActive: owner.isActive,
    createdAt: owner.createdAt.toISOString(),
    updatedAt: owner.updatedAt.toISOString(),
    properties: owner.properties,
  };
}

export const GET = withApiAuth(async (_request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  try {
    const owner = await getOwner(id);
    return jsonUtf8({ owner: serializeOwnerDetail(owner) });
  } catch (error) {
    if (error instanceof FinanceDomainError) return financeErrorResponse(error);
    throw error;
  }
});

export const PATCH = withApiAuth(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Некорректный JSON", 400, { code: "VALIDATION_ERROR" });
  }

  const parsed = updateOwnerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }

  try {
    const owner = await updateOwner(id, parsed.data);
    const detail = await getOwner(owner.id);
    return jsonUtf8({ owner: serializeOwnerDetail(detail) });
  } catch (error) {
    if (error instanceof FinanceDomainError) return financeErrorResponse(error);
    throw error;
  }
});
