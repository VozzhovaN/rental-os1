import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { NextResponse } from "next/server";
import { Readable } from "stream";
import { prisma } from "@/lib/prisma";
import { getPropertyByIdOrSlug } from "@/lib/properties";
import { getPhotoStorage } from "@/lib/photo-storage";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const GET = withApiAuth(async (
  _request: Request,
  context: { params: Promise<{ id: string; photoId: string }> },
) => {
  const { id, photoId } = await context.params;
  const property = await getPropertyByIdOrSlug(id);
  if (!property) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  const photo = await prisma.propertyPhoto.findFirst({
    where: { id: photoId, propertyId: property.id },
  });
  if (!photo) {
    return NextResponse.json({ error: "Фотография не найдена" }, { status: 404 });
  }

  if (!photo.storageKey) {
    if (photo.url.startsWith("http://") || photo.url.startsWith("https://") || photo.url.startsWith("/")) {
      return NextResponse.redirect(new URL(photo.url, _request.url));
    }
    return NextResponse.json({ error: "Файл недоступен" }, { status: 404 });
  }

  try {
    const absolutePath = getPhotoStorage().resolveAbsolutePath(photo.storageKey);
    const fileStat = await stat(absolutePath);
    const nodeStream = createReadStream(absolutePath);
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": photo.mimeType || "application/octet-stream",
        "Content-Length": String(fileStat.size),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Файл недоступен" }, { status: 404 });
  }
});
