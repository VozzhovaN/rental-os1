/** Shared client helpers for PropertyPhoto uploads. */

import type { PropertyPhotoDTO } from "@/lib/property-photos";

export const CLIENT_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

export async function readApiJson<T extends { error?: string }>(
  response: Response,
): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error("Не удалось загрузить фотографию. Попробуйте ещё раз.");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Не удалось загрузить фотографию. Попробуйте ещё раз.");
  }
}

export function assertClientPhotoFile(file: File) {
  if (file.size <= 0) {
    throw new Error("Выберите файл изображения");
  }
  if (file.size > CLIENT_PHOTO_MAX_BYTES) {
    throw new Error("Файл слишком большой. Максимальный размер — 10 МБ.");
  }
}

/**
 * Upload one or more files sequentially (avoids huge multipart bodies).
 */
export async function uploadPropertyPhotos(
  propertyId: string,
  files: File[],
): Promise<PropertyPhotoDTO[]> {
  if (files.length === 0) {
    throw new Error("Выберите файл изображения");
  }

  const uploaded: PropertyPhotoDTO[] = [];

  for (const file of files) {
    assertClientPhotoFile(file);
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`/api/properties/${propertyId}/photos`, {
      method: "POST",
      body: form,
    });
    const payload = await readApiJson<{
      error?: string;
      photo?: PropertyPhotoDTO;
      photos?: PropertyPhotoDTO[];
    }>(response);

    if (!response.ok) {
      throw new Error(payload.error || "Не удалось загрузить фотографию. Попробуйте ещё раз.");
    }

    const batch = payload.photos ?? (payload.photo ? [payload.photo] : []);
    if (batch.length === 0) {
      throw new Error("Не удалось загрузить фотографию. Попробуйте ещё раз.");
    }
    uploaded.push(...batch);
  }

  return uploaded;
}
