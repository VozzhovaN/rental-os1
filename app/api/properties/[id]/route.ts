import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { Prisma } from "@prisma/client";
import {
  PropertyError,
  deleteProperty,
  getPropertyByIdOrSlug,
  updateProperty,
} from "@/lib/properties";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  formatZodError,
  updatePropertySchema,
} from "@/lib/validations/property";

export const GET = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const property = await getPropertyByIdOrSlug(id);

  if (!property) {
    return jsonError("Объект не найден", 404, { code: "NOT_FOUND" });
  }

  return jsonUtf8({ property });
});

export const PATCH = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const existing = await getPropertyByIdOrSlug(id);

  if (!existing) {
    return jsonError("Объект не найден", 404, { code: "NOT_FOUND" });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Некорректный JSON", 400, { code: "VALIDATION_ERROR" });
  }

  const parsed = updatePropertySchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }

  try {
    const property = await updateProperty(existing.id, parsed.data);
    return jsonUtf8({ property });
  } catch (error) {
    if (error instanceof PropertyError) {
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("Объект с таким slug уже существует", 409, { code: "CONFLICT" });
    }

    throw error;
  }
});

export const DELETE = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const existing = await getPropertyByIdOrSlug(id);

  if (!existing) {
    return jsonError("Объект не найден", 404, { code: "NOT_FOUND" });
  }

  try {
    const deleted = await deleteProperty(existing.id);
    if (!deleted) {
      return jsonError("Объект не найден", 404, { code: "NOT_FOUND" });
    }
    return jsonUtf8({ ok: true });
  } catch (error) {
    if (error instanceof PropertyError) {
      return jsonError(error.message, error.code === "CONFLICT" ? 409 : 404, {
        code: error.code === "CONFLICT" ? "CONFLICT" : "NOT_FOUND",
      });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return jsonError("Нельзя удалить объект, пока к нему привязаны связанные записи", 409, {
        code: "CONFLICT",
      });
    }

    throw error;
  }
});
