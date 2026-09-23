import type { PropertyPhoto } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPropertyByIdOrSlug } from "@/lib/properties";
import { getPhotoStorage } from "@/lib/photo-storage";
import {
  processPropertyPhotoUpload,
  PropertyPhotoValidationError,
} from "@/lib/property-photo-process";
import type { CreatePropertyPhotoInput } from "@/lib/validations/long-term-listing";

export class PropertyPhotoError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "STORAGE",
  ) {
    super(message);
    this.name = "PropertyPhotoError";
  }
}

export { PropertyPhotoValidationError };

function fileUrl(propertyId: string, photoId: string) {
  return `/api/properties/${propertyId}/photos/${photoId}/file`;
}

export async function getPropertyPhotos(propertyId: string) {
  const property = await getPropertyByIdOrSlug(propertyId);
  if (!property) {
    throw new PropertyPhotoError("Объект не найден", "NOT_FOUND");
  }
  return prisma.propertyPhoto.findMany({
    where: { propertyId: property.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function getPropertyCoverPhoto(propertyId: string) {
  const cover = await prisma.propertyPhoto.findFirst({
    where: { propertyId, isCover: true },
    orderBy: { sortOrder: "asc" },
  });
  if (cover) {
    return cover;
  }
  return prisma.propertyPhoto.findFirst({
    where: { propertyId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

/** Legacy / URL-only create (external HTTPS or relative path). */
export async function createPropertyPhoto(propertyId: string, input: CreatePropertyPhotoInput) {
  const property = await getPropertyByIdOrSlug(propertyId);

  if (!property) {
    throw new PropertyPhotoError("Объект не найден", "NOT_FOUND");
  }

  return prisma.$transaction(async (tx) => {
    const count = await tx.propertyPhoto.count({ where: { propertyId: property.id } });
    const last = await tx.propertyPhoto.findFirst({
      where: { propertyId: property.id },
      orderBy: { sortOrder: "desc" },
    });

    return tx.propertyPhoto.create({
      data: {
        propertyId: property.id,
        url: input.url,
        caption: input.caption ?? null,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        isCover: count === 0,
      },
    });
  });
}

export async function uploadPropertyPhotoFile(
  propertyId: string,
  file: File,
  options?: { caption?: string | null },
) {
  const property = await getPropertyByIdOrSlug(propertyId);
  if (!property) {
    throw new PropertyPhotoError("Объект не найден", "NOT_FOUND");
  }

  const raw = Buffer.from(await file.arrayBuffer());
  let processed;
  try {
    processed = await processPropertyPhotoUpload(raw, file.type);
  } catch (error) {
    if (error instanceof PropertyPhotoValidationError) {
      throw new PropertyPhotoError(error.message, "VALIDATION");
    }
    throw new PropertyPhotoError("Не удалось загрузить фотографию. Попробуйте ещё раз.", "VALIDATION");
  }

  const storage = getPhotoStorage();
  const saved = await storage.save({
    propertyId: property.id,
    bytes: processed.bytes,
    mimeType: processed.mimeType,
    extension: processed.extension,
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const count = await tx.propertyPhoto.count({ where: { propertyId: property.id } });
      const last = await tx.propertyPhoto.findFirst({
        where: { propertyId: property.id },
        orderBy: { sortOrder: "desc" },
      });

      const created = await tx.propertyPhoto.create({
        data: {
          propertyId: property.id,
          storageKey: saved.storageKey,
          originalFileName: sanitizeOriginalFileName(file.name),
          mimeType: processed.mimeType,
          sizeBytes: processed.sizeBytes,
          width: processed.width,
          height: processed.height,
          caption: options?.caption ?? null,
          sortOrder: (last?.sortOrder ?? -1) + 1,
          isCover: count === 0,
          url: "pending",
        },
      });

      return tx.propertyPhoto.update({
        where: { id: created.id },
        data: { url: fileUrl(property.id, created.id) },
      });
    });
  } catch (error) {
    try {
      await storage.delete(saved.storageKey);
    } catch {
      // ignore cleanup failure
    }
    throw error;
  }
}

function sanitizeOriginalFileName(name: string | undefined) {
  if (!name) {
    return null;
  }
  const base = name.replace(/[/\\]/g, "").trim().slice(0, 255);
  return base || null;
}

export async function setPropertyPhotoCover(propertyId: string, photoId: string) {
  const property = await getPropertyByIdOrSlug(propertyId);
  if (!property) {
    throw new PropertyPhotoError("Объект не найден", "NOT_FOUND");
  }

  return prisma.$transaction(async (tx) => {
    const photo = await tx.propertyPhoto.findFirst({
      where: { id: photoId, propertyId: property.id },
    });
    if (!photo) {
      throw new PropertyPhotoError("Фотография не найдена", "NOT_FOUND");
    }

    await tx.propertyPhoto.updateMany({
      where: { propertyId: property.id },
      data: { isCover: false },
    });

    return tx.propertyPhoto.update({
      where: { id: photo.id },
      data: { isCover: true },
    });
  });
}

export async function reorderPropertyPhotos(propertyId: string, photoIds: string[]) {
  const property = await getPropertyByIdOrSlug(propertyId);
  if (!property) {
    throw new PropertyPhotoError("Объект не найден", "NOT_FOUND");
  }

  if (photoIds.length === 0) {
    throw new PropertyPhotoError("Укажите порядок фотографий", "VALIDATION");
  }

  const unique = new Set(photoIds);
  if (unique.size !== photoIds.length) {
    throw new PropertyPhotoError("Дубликаты идентификаторов запрещены", "VALIDATION");
  }

  const existing = await prisma.propertyPhoto.findMany({
    where: { propertyId: property.id },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((item) => item.id));

  if (photoIds.length !== existingIds.size) {
    throw new PropertyPhotoError("Список фотографий неполный или содержит чужие id", "VALIDATION");
  }
  for (const id of photoIds) {
    if (!existingIds.has(id)) {
      throw new PropertyPhotoError("Список фотографий содержит чужие id", "VALIDATION");
    }
  }

  await prisma.$transaction(
    photoIds.map((id, index) =>
      prisma.propertyPhoto.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );

  return getPropertyPhotos(property.id);
}

export async function deletePropertyPhoto(propertyId: string, photoId: string) {
  const property = await getPropertyByIdOrSlug(propertyId);
  if (!property) {
    throw new PropertyPhotoError("Объект не найден", "NOT_FOUND");
  }

  const photo = await prisma.propertyPhoto.findFirst({
    where: { id: photoId, propertyId: property.id },
  });
  if (!photo) {
    throw new PropertyPhotoError("Фотография не найдена", "NOT_FOUND");
  }

  const storageKey = photo.storageKey;

  await prisma.$transaction(async (tx) => {
    await tx.longTermListingPhoto.deleteMany({ where: { photoId: photo.id } });
    await tx.saleListingPhoto.deleteMany({ where: { propertyPhotoId: photo.id } });
    await tx.propertyPhoto.delete({ where: { id: photo.id } });

    if (photo.isCover) {
      const next = await tx.propertyPhoto.findFirst({
        where: { propertyId: property.id },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
      if (next) {
        await tx.propertyPhoto.update({
          where: { id: next.id },
          data: { isCover: true },
        });
      }
    }
  });

  if (storageKey) {
    try {
      await getPhotoStorage().delete(storageKey);
    } catch (error) {
      console.error("[property-photos] filesystem delete failed", {
        photoId: photo.id,
        code: (error as NodeJS.ErrnoException).code,
      });
      throw new PropertyPhotoError(
        "Фотография удалена из базы, но файл на диске удалить не удалось",
        "STORAGE",
      );
    }
  }

  return true;
}

export type PropertyPhotoDTO = {
  id: string;
  propertyId: string;
  url: string;
  storageKey: string | null;
  originalFileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  sortOrder: number;
  isCover: boolean;
  createdAt: string;
  updatedAt: string;
};

export function serializePropertyPhoto(photo: PropertyPhoto): PropertyPhotoDTO {
  return {
    id: photo.id,
    propertyId: photo.propertyId,
    url: photo.url,
    storageKey: photo.storageKey,
    originalFileName: photo.originalFileName,
    mimeType: photo.mimeType,
    sizeBytes: photo.sizeBytes,
    width: photo.width,
    height: photo.height,
    caption: photo.caption,
    sortOrder: photo.sortOrder,
    isCover: photo.isCover,
    createdAt: photo.createdAt.toISOString(),
    updatedAt: photo.updatedAt.toISOString(),
  };
}
