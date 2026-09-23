import { Prisma, type Property } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import type {
  CreatePropertyInput,
  UpdatePropertyInput,
} from "@/lib/validations/property";

export class PropertyError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "CONFLICT" | "VALIDATION",
  ) {
    super(message);
    this.name = "PropertyError";
  }
}

type ManagementType = CreatePropertyInput["managementType"];

async function resolveOwnerIdForProperty(
  managementType: ManagementType,
  ownerIdInput: string | null | undefined,
  current?: { ownerId: string | null },
): Promise<string | null> {
  if (managementType === "OWN") {
    return null;
  }

  const ownerId =
    ownerIdInput !== undefined ? ownerIdInput : (current?.ownerId ?? null);

  if (!ownerId) {
    return null;
  }

  const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
  if (!owner) {
    throw new PropertyError("Собственник не найден", "NOT_FOUND");
  }
  if (!owner.isActive) {
    throw new PropertyError("Нельзя привязать неактивного собственника", "VALIDATION");
  }

  return ownerId;
}

export type PropertyDTO = Omit<Property, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
  coverPhotoUrl?: string | null;
};

export function serializeProperty(
  property: Property & { photos?: { url: string; isCover: boolean }[] },
): PropertyDTO {
  const cover =
    property.photos?.find((photo) => photo.isCover)?.url ??
    property.photos?.[0]?.url ??
    null;
  const { photos: _photos, ...rest } = property as Property & {
    photos?: { url: string; isCover: boolean }[];
  };
  void _photos;
  return {
    ...rest,
    coverPhotoUrl: cover,
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
  };
}

export async function getProperties() {
  return prisma.property.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      photos: {
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
        take: 1,
        select: { url: true, isCover: true },
      },
    },
  });
}

export async function getPropertyByIdOrSlug(idOrSlug: string) {
  return prisma.property.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
  });
}

async function ensureUniqueSlug(baseSlug: string, excludeId?: string) {
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await prisma.property.findUnique({
      where: { slug },
    });

    if (!existing || existing.id === excludeId) {
      return slug;
    }

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function assertRentCollectionMode(
  managementType: ManagementType,
  rentCollectionMode: CreatePropertyInput["rentCollectionMode"],
) {
  if (managementType === "OWN" && rentCollectionMode === "OWNER_DIRECT") {
    throw new PropertyError(
      "Собственный объект не может использовать прямой сбор аренды собственником",
      "VALIDATION",
    );
  }
}

export async function createProperty(input: CreatePropertyInput) {
  const slug = await ensureUniqueSlug(input.slug ? slugify(input.slug) : slugify(input.name));
  const ownerId = await resolveOwnerIdForProperty(input.managementType, input.ownerId);
  const rentCollectionMode = input.rentCollectionMode ?? "OPERATOR";
  assertRentCollectionMode(input.managementType, rentCollectionMode);

  return prisma.property.create({
    data: {
      ...input,
      slug,
      ownerId,
      rentCollectionMode,
    },
  });
}

export async function updateProperty(id: string, input: UpdatePropertyInput) {
  const current = await prisma.property.findUnique({
    where: { id },
  });

  if (!current) {
    return null;
  }

  const nextSlugSource = input.slug ?? (input.name && input.name !== current.name ? input.name : current.slug);
  const slug = await ensureUniqueSlug(slugify(nextSlugSource), id);
  const managementType = input.managementType ?? current.managementType;
  const rentCollectionMode =
    input.rentCollectionMode ?? current.rentCollectionMode ?? "OPERATOR";
  assertRentCollectionMode(managementType, rentCollectionMode);
  const ownerId = await resolveOwnerIdForProperty(managementType, input.ownerId, current);

  return prisma.property.update({
    where: { id },
    data: {
      ...input,
      slug,
      managementType,
      rentCollectionMode,
      ownerId,
    },
  });
}

export async function deleteProperty(id: string) {
  const bookings = await prisma.booking.count({ where: { propertyId: id } });
  if (bookings > 0) {
    throw new PropertyError("Нельзя удалить объект с бронированиями", "CONFLICT");
  }

  const longTerm = await prisma.longTermListing.findUnique({ where: { propertyId: id } });
  if (longTerm) {
    throw new PropertyError("Сначала архивируйте карточку долгосрочной аренды", "CONFLICT");
  }

  const channels = await prisma.channelListing.count({ where: { propertyId: id } });
  if (channels > 0) {
    throw new PropertyError("Сначала отключите объект от каналов продаж", "CONFLICT");
  }

  try {
    await prisma.property.delete({
      where: { id },
    });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return false;
    }

    throw error;
  }
}
