import { NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import {
  getPresentationByPublicToken,
  isPubliclyAccessible,
} from "@/lib/presentations";
import { prisma } from "@/lib/prisma";
import { getPhotoStorage } from "@/lib/photo-storage";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string; photoId: string }> },
) {
  const { token, photoId } = await context.params;
  if (!token || token.length < 16 || !photoId) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  const presentation = await getPresentationByPublicToken(token);
  if (!presentation || !isPubliclyAccessible(presentation.status)) {
    return NextResponse.json(
      { error: "Не найдено" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const allowedIds = new Set<string>();
  for (const item of presentation.items) {
    if (item.coverPhotoId) allowedIds.add(item.coverPhotoId);
    for (const row of item.photos) allowedIds.add(row.propertyPhotoId);
    for (const photo of item.property.photos) allowedIds.add(photo.id);
  }

  if (!allowedIds.has(photoId)) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  const photo = await prisma.propertyPhoto.findUnique({ where: { id: photoId } });
  if (!photo) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  if (!photo.storageKey) {
    if (
      photo.url.startsWith("http://") ||
      photo.url.startsWith("https://") ||
      photo.url.startsWith("/")
    ) {
      return NextResponse.redirect(new URL(photo.url, request.url));
    }
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  try {
    const absolutePath = getPhotoStorage().resolveAbsolutePath(photo.storageKey);
    const fileStat = await stat(absolutePath);
    const nodeStream = createReadStream(absolutePath);
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": photo.mimeType || "image/jpeg",
        "Content-Length": String(fileStat.size),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
}
