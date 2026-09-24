import { NextResponse } from "next/server";
import { getPropertyByIdOrSlug } from "@/lib/properties";
import {
  createPropertyPhoto,
  getPropertyPhotos,
  MAX_PHOTOS_PER_UPLOAD,
  PropertyPhotoError,
  serializePropertyPhoto,
  uploadPropertyPhotoFile,
} from "@/lib/property-photos";
import { createPropertyPhotoSchema } from "@/lib/validations/long-term-listing";
import { formatZodError } from "@/lib/validations/property";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const GET = withApiAuth(async (
  _request: Request,
  context: { params: Promise<{ id: string }> },
) => {
  const { id } = await context.params;

  try {
    const photos = (await getPropertyPhotos(id)).map(serializePropertyPhoto);
    return NextResponse.json({ photos });
  } catch (error) {
    if (error instanceof PropertyPhotoError && error.code === "NOT_FOUND") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
});

export const POST = withApiAuth(async (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => {
  const { id } = await context.params;
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    try {
      const property = await getPropertyByIdOrSlug(id);
      if (!property) {
        return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
      }

      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return NextResponse.json(
          {
            error:
              "Не удалось прочитать файл. Убедитесь, что размер не превышает 10 МБ, и попробуйте ещё раз.",
          },
          { status: 400 },
        );
      }

      const files = form
        .getAll("files")
        .concat(form.getAll("file"))
        .filter((entry): entry is File => entry instanceof File && entry.size > 0);

      if (files.length === 0) {
        return NextResponse.json({ error: "Выберите файл изображения" }, { status: 400 });
      }

      if (files.length > MAX_PHOTOS_PER_UPLOAD) {
        return NextResponse.json(
          {
            error: `За один раз можно загрузить не более ${MAX_PHOTOS_PER_UPLOAD} фотографий.`,
          },
          { status: 400 },
        );
      }

      const captionRaw = form.get("caption");
      const caption =
        typeof captionRaw === "string" && captionRaw.trim() ? captionRaw.trim() : null;

      const photos = [];
      for (const file of files) {
        const photo = await uploadPropertyPhotoFile(property.id, file, { caption });
        photos.push(serializePropertyPhoto(photo));
      }

      if (photos.length === 1) {
        return NextResponse.json({ photo: photos[0], photos }, { status: 201 });
      }
      return NextResponse.json({ photos }, { status: 201 });
    } catch (error) {
      if (error instanceof PropertyPhotoError) {
        const status =
          error.code === "NOT_FOUND" ? 404 : error.code === "VALIDATION" ? 400 : 500;
        return NextResponse.json({ error: error.message }, { status });
      }
      console.error("[property-photos] upload failed", {
        name: error instanceof Error ? error.name : "unknown",
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: "Не удалось загрузить фотографию. Попробуйте ещё раз." },
        { status: 500 },
      );
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = createPropertyPhotoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка валидации", details: formatZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const photo = await createPropertyPhoto(id, parsed.data);
    return NextResponse.json({ photo: serializePropertyPhoto(photo) }, { status: 201 });
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
