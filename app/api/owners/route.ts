import { jsonError, jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  FinanceDomainError,
  createOwner,
  createOwnerSchema,
  listOwners,
} from "@/lib/finance";
import { formatZodError } from "@/lib/validations/property";

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

function serializeOwner(owner: Awaited<ReturnType<typeof listOwners>>[number]) {
  return {
    id: owner.id,
    name: owner.name,
    phone: owner.phone,
    email: owner.email,
    notes: owner.notes,
    isActive: owner.isActive,
    propertiesCount: owner._count.properties,
    createdAt: owner.createdAt.toISOString(),
    updatedAt: owner.updatedAt.toISOString(),
  };
}

export const GET = withApiAuth(async () => {
  const owners = (await listOwners()).map(serializeOwner);
  return jsonUtf8({ owners });
});

export const POST = withApiAuth(async (request: Request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Некорректный JSON", 400, { code: "VALIDATION_ERROR" });
  }

  const parsed = createOwnerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }

  try {
    const owner = await createOwner(parsed.data);
    return jsonUtf8(
      {
        owner: {
          id: owner.id,
          name: owner.name,
          phone: owner.phone,
          email: owner.email,
          notes: owner.notes,
          isActive: owner.isActive,
          createdAt: owner.createdAt.toISOString(),
          updatedAt: owner.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof FinanceDomainError) return financeErrorResponse(error);
    throw error;
  }
});
