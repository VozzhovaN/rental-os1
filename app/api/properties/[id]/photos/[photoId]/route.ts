import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deletePropertyPhoto,
  PropertyPhotoError,
  serializePropertyPhoto,
  setPropertyPhotoCover,
} from "@/lib/property-photos";
import { formatZodError } from "@/lib/validations/property";
import { withApiAuth } from "@/lib/auth/with-api-auth";

const patchSchema = z
  .object({
    action: z.literal("setCover"),
  })
  .strict();

export const PATCH = withApiAuth(async (
  request: Request,
  context: { params: Promise<{ id: string; photoId: string }> },
) => {
  const { id, photoId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка валидации", details: formatZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const photo = await setPropertyPhotoCover(id, photoId);
    return NextResponse.json({ photo: serializePropertyPhoto(photo) });
  } catch (error) {
    if (error instanceof PropertyPhotoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "NOT_FOUND" ? 404 : 400 },
      );
    }
    throw error;
  }
});

export const DELETE = withApiAuth(async (
  _request: Request,
  context: { params: Promise<{ id: string; photoId: string }> },
) => {
  const { id, photoId } = await context.params;

  try {
    await deletePropertyPhoto(id, photoId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PropertyPhotoError) {
      const status =
        error.code === "NOT_FOUND" ? 404 : error.code === "STORAGE" ? 500 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
});
