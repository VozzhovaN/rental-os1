import { Prisma, type Property, type SaleListing, type SaleListingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPropertyByIdOrSlug, serializeProperty, type PropertyDTO } from "@/lib/properties";
import {
  SALE_LISTING_UPDATE_KEYS,
  type CreateSaleListingInput,
  type SaleListingPhotosInput,
  type UpdateSaleListingInput,
} from "@/lib/validations/sale-listing";

export class SaleListingError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "CONFLICT" | "VALIDATION",
  ) {
    super(message);
    this.name = "SaleListingError";
  }
}

const listingInclude = {
  property: true,
  photos: {
    include: { propertyPhoto: true },
    orderBy: { order: "asc" as const },
  },
} as const;

type ListingRecord = SaleListing & {
  property: Property;
  photos: Array<{
    id: string;
    saleListingId: string;
    propertyPhotoId: string;
    order: number;
    propertyPhoto: {
      id: string;
      propertyId: string;
      url: string;
      caption: string | null;
      sortOrder: number;
      createdAt: Date;
    };
  }>;
};

export type SaleListingDTO = {
  id: string;
  propertyId: string;
  status: SaleListingStatus;
  price: number;
  marketingTitle: string | null;
  description: string | null;
  specialOfferPrice: number | null;
  specialOfferText: string | null;
  advantages: string | null;
  infrastructure: string | null;
  security: string | null;
  parking: string | null;
  transport: string | null;
  publicationContactName: string | null;
  publicationPhoneCountryCode: string | null;
  publicationPhoneNumber: string | null;
  crmOwnerName: string | null;
  crmOwnerPhone: string | null;
  crmComment: string | null;
  createdAt: string;
  updatedAt: string;
  property: PropertyDTO;
  photos: Array<{
    id: string;
    photoId: string;
    order: number;
    url: string;
    caption: string | null;
  }>;
};

export function serializeSaleListing(listing: ListingRecord): SaleListingDTO {
  return {
    id: listing.id,
    propertyId: listing.propertyId,
    status: listing.status,
    price: listing.price,
    marketingTitle: listing.marketingTitle,
    description: listing.description,
    specialOfferPrice: listing.specialOfferPrice,
    specialOfferText: listing.specialOfferText,
    advantages: listing.advantages,
    infrastructure: listing.infrastructure,
    security: listing.security,
    parking: listing.parking,
    transport: listing.transport,
    publicationContactName: listing.publicationContactName,
    publicationPhoneCountryCode: listing.publicationPhoneCountryCode,
    publicationPhoneNumber: listing.publicationPhoneNumber,
    crmOwnerName: listing.crmOwnerName,
    crmOwnerPhone: listing.crmOwnerPhone,
    crmComment: listing.crmComment,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
    property: serializeProperty(listing.property),
    photos: listing.photos.map((item) => ({
      id: item.id,
      photoId: item.propertyPhotoId,
      order: item.order,
      url: item.propertyPhoto.url,
      caption: item.propertyPhoto.caption,
    })),
  };
}

export async function getSaleListings(filters: {
  q?: string;
  status?: SaleListingStatus;
  sort?: "updatedAt" | "price" | "name";
} = {}) {
  const sort = filters.sort ?? "updatedAt";

  return prisma.saleListing.findMany({
    where: {
      status: filters.status,
      OR: filters.q
        ? [
            { marketingTitle: { contains: filters.q } },
            { property: { name: { contains: filters.q } } },
            { property: { city: { contains: filters.q } } },
          ]
        : undefined,
    },
    include: listingInclude,
    orderBy:
      sort === "price"
        ? { price: "asc" }
        : sort === "name"
          ? { property: { name: "asc" } }
          : { updatedAt: "desc" },
  });
}

export async function getSaleListingById(id: string) {
  return prisma.saleListing.findUnique({
    where: { id },
    include: listingInclude,
  });
}

export async function getSaleListingByPropertyId(propertyId: string) {
  return prisma.saleListing.findUnique({
    where: { propertyId },
    include: listingInclude,
  });
}

export async function createSaleListing(input: CreateSaleListingInput) {
  const property = await getPropertyByIdOrSlug(input.propertyId);

  if (!property) {
    throw new SaleListingError("Объект не найден", "NOT_FOUND");
  }

  const existing = await prisma.saleListing.findUnique({
    where: { propertyId: property.id },
    include: listingInclude,
  });

  if (existing) {
    return { listing: existing, created: false as const };
  }

  try {
    const listing = await prisma.saleListing.create({
      data: {
        propertyId: property.id,
        status: "DRAFT",
        price: 0,
        marketingTitle: property.name,
      },
      include: listingInclude,
    });
    return { listing, created: true as const };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const listing = await prisma.saleListing.findUnique({
        where: { propertyId: property.id },
        include: listingInclude,
      });
      if (listing) {
        return { listing, created: false as const };
      }
      throw new SaleListingError("Объект уже добавлен в продажи", "CONFLICT");
    }
    throw error;
  }
}

function listingUpdateData(input: UpdateSaleListingInput): Prisma.SaleListingUpdateInput {
  const data: Prisma.SaleListingUpdateInput = {};

  for (const key of SALE_LISTING_UPDATE_KEYS) {
    const value = input[key];
    if (value !== undefined) {
      Object.assign(data, { [key]: value });
    }
  }

  return data;
}

function assertActivePrice(nextStatus: SaleListingStatus, nextPrice: number) {
  if (nextStatus === "ACTIVE" && nextPrice <= 0) {
    throw new SaleListingError("Для статуса ACTIVE цена должна быть больше 0", "VALIDATION");
  }
}

export async function updateSaleListing(id: string, input: UpdateSaleListingInput) {
  const current = await getSaleListingById(id);

  if (!current) {
    throw new SaleListingError("Карточка продажи не найдена", "NOT_FOUND");
  }

  if (current.status === "ARCHIVED" && input.status !== undefined && input.status !== "ARCHIVED") {
    throw new SaleListingError("Архивная карточка не может быть восстановлена", "VALIDATION");
  }

  if (current.status === "SOLD") {
    const crmOnlyKeys = new Set(["crmOwnerName", "crmOwnerPhone", "crmComment"]);
    const keys = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    const disallowed = keys.filter((key) => !crmOnlyKeys.has(key) && key !== "status");
    if (input.status !== undefined && input.status !== "ARCHIVED") {
      throw new SaleListingError("Проданную карточку нельзя изменить через этот API", "VALIDATION");
    }
    if (disallowed.length > 0 && input.status !== "ARCHIVED") {
      throw new SaleListingError(
        "Для проданной карточки можно менять только CRM-поля собственника и комментарий",
        "VALIDATION",
      );
    }
  }

  const nextStatus = input.status ?? current.status;
  const nextPrice = input.price ?? current.price;
  assertActivePrice(nextStatus, nextPrice);

  return prisma.saleListing.update({
    where: { id },
    data: listingUpdateData(input),
    include: listingInclude,
  });
}

export async function archiveSaleListing(id: string) {
  return updateSaleListing(id, { status: "ARCHIVED" });
}

export async function replaceSaleListingPhotos(id: string, input: SaleListingPhotosInput) {
  const current = await getSaleListingById(id);

  if (!current) {
    throw new SaleListingError("Карточка продажи не найдена", "NOT_FOUND");
  }

  const photoIds = input.items.map((item) => item.photoId);

  if (photoIds.length !== new Set(photoIds).size) {
    throw new SaleListingError("Фотография не может быть добавлена дважды", "VALIDATION");
  }

  const photos = await prisma.propertyPhoto.findMany({
    where: { id: { in: photoIds }, propertyId: current.propertyId },
  });

  if (photos.length !== photoIds.length) {
    throw new SaleListingError("Можно выбирать только фотографии этого объекта", "VALIDATION");
  }

  await prisma.$transaction(async (tx) => {
    await tx.saleListingPhoto.deleteMany({ where: { saleListingId: id } });
    if (input.items.length === 0) {
      return;
    }
    await tx.saleListingPhoto.createMany({
      data: input.items.map((item) => ({
        saleListingId: id,
        propertyPhotoId: item.photoId,
        order: item.order,
      })),
    });
  });

  return getSaleListingById(id);
}
