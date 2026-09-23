import { NextResponse } from "next/server";
import { z } from "zod";
import {
  PropertyPhotoError,
  reorderPropertyPhotos,
  serializePropertyPhoto,
} from "@/lib/property-photos";
import { formatZodError } from "@/lib/validations/property";
import { withApiAuth } from "@/lib/auth/with-api-auth";

const reorderSchema = z
  .object({
    photoIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const PATCH = withApiAuth(async (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => {
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка валидации", details: formatZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const photos = (await reorderPropertyPhotos(id, parsed.data.photoIds)).map(
      serializePropertyPhoto,
    );
    return NextResponse.json({ photos });
  } catch (error) {
    if (error instanceof PropertyPhotoError) {
      const status =
        error.code === "NOT_FOUND" ? 404 : error.code === "VALIDATION" ? 400 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
});
