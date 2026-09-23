import { withApiAuth } from "@/lib/auth/with-api-auth";
import { jsonError, jsonUtf8 } from "@/lib/api-json";
import {
  createPresentation,
  getPresentations,
  PresentationError,
} from "@/lib/presentations";
import { serializePresentationListItem } from "@/lib/presentation-public";
import {
  createPresentationSchema,
  formatZodError,
} from "@/lib/validations/presentation";

export const GET = withApiAuth(async () => {
  const rows = await getPresentations();
  return jsonUtf8({
    presentations: rows.map(serializePresentationListItem),
  });
});

export const POST = withApiAuth(async (request: Request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Некорректный JSON", 400, { code: "VALIDATION_ERROR" });
  }

  const parsed = createPresentationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Ошибка валидации", 400, {
      code: "VALIDATION_ERROR",
      details: formatZodError(parsed.error),
    });
  }

  try {
    const presentation = await createPresentation(parsed.data);
    return jsonUtf8({ presentation: { id: presentation.id } }, { status: 201 });
  } catch (error) {
    if (error instanceof PresentationError) {
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
    throw error;
  }
});
