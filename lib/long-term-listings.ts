import { Prisma, type LongTermListing, type LongTermListingStatus, type Property } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPropertyByIdOrSlug, serializeProperty, type PropertyDTO } from "@/lib/properties";
import {
  LONG_TERM_UPDATE_KEYS,
  type CreateLongTermListingInput,
  type LongTermPhotosInput,
  type UpdateLongTermListingInput,
} from "@/lib/validations/long-term-listing";

export class LongTermListingError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "CONFLICT" | "VALIDATION",
  ) {
    super(message);
    this.name = "LongTermListingError";
  }
}

const listingInclude = {
  property: true,
  photos: {
    include: { photo: true },
    orderBy: { sortOrder: "asc" as const },
  },
} as const;

type ListingRecord = LongTermListing & {
  property: Property;
  photos: Array<{
    id: string;
    listingId: string;
    photoId: string;
    sortOrder: number;
    included: boolean;
    photo: {
      id: string;
      propertyId: string;
      url: string;
      caption: string | null;
      sortOrder: number;
      createdAt: Date;
    };
  }>;
};

export type LongTermListingDTO = {
  id: string;
  propertyId: string;
  status: LongTermListingStatus;
  monthlyPrice: number;
  specialOfferPrice: number | null;
  specialOfferText: string | null;
  deposit: number;
  commission: number;
  minimumRentalPeriod: number;
  marketingTitle: string;
  description: string;
  rentalTerms: string;
  infrastructureDescription: string;
  securityDescription: string;
  parkingDescription: string;
  transportDescription: string;
  advantagesDescription: string;
  publicationContactName: string | null;
  publicationPhoneCountryCode: string | null;
  publicationPhoneNumber: string | null;
  createdAt: string;
  updatedAt: string;
  property: PropertyDTO;
  photos: Array<{
    id: string;
    photoId: string;
    sortOrder: number;
    included: boolean;
    url: string;
    caption: string | null;
  }>;
};

export function serializeLongTermListing(listing: ListingRecord): LongTermListingDTO {
  return {
    id: listing.id,
    propertyId: listing.propertyId,
    status: listing.status,
    monthlyPrice: listing.monthlyPrice,
    specialOfferPrice: listing.specialOfferPrice,
    specialOfferText: listing.specialOfferText,
    deposit: listing.deposit,
    commission: listing.commission,
    minimumRentalPeriod: listing.minimumRentalPeriod,
    marketingTitle: listing.marketingTitle,
    description: listing.description,
    rentalTerms: listing.rentalTerms,
    infrastructureDescription: listing.infrastructureDescription,
    securityDescription: listing.securityDescription,
    parkingDescription: listing.parkingDescription,
    transportDescription: listing.transportDescription,
    advantagesDescription: listing.advantagesDescription,
    publicationContactName: listing.publicationContactName,
    publicationPhoneCountryCode: listing.publicationPhoneCountryCode,
    publicationPhoneNumber: listing.publicationPhoneNumber,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
    property: serializeProperty(listing.property),
    photos: listing.photos.map((item) => ({
      id: item.id,
      photoId: item.photoId,
      sortOrder: item.sortOrder,
      included: item.included,
      url: item.photo.url,
      caption: item.photo.caption,
    })),
  };
}

export async function getLongTermListings(filters: {
  q?: string;
  status?: LongTermListingStatus;
  sort?: "updatedAt" | "monthlyPrice" | "name";
} = {}) {
  const sort = filters.sort ?? "updatedAt";

  return prisma.longTermListing.findMany({
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
      sort === "monthlyPrice"
        ? { monthlyPrice: "asc" }
        : sort === "name"
          ? { property: { name: "asc" } }
          : { updatedAt: "desc" },
  });
}

export async function getLongTermListingById(id: string) {
  return prisma.longTermListing.findUnique({
    where: { id },
    include: listingInclude,
  });
}

export async function getLongTermListingByPropertyId(propertyId: string) {
  return prisma.longTermListing.findUnique({
    where: { propertyId },
    include: listingInclude,
  });
}

export async function createLongTermListing(input: CreateLongTermListingInput) {
  const property = await getPropertyByIdOrSlug(input.propertyId);

  if (!property) {
    throw new LongTermListingError("Объект не найден", "NOT_FOUND");
  }

  const existing = await prisma.longTermListing.findUnique({
    where: { propertyId: property.id },
    include: listingInclude,
  });

  if (existing) {
    return { listing: existing, created: false as const };
  }

  try {
    const listing = await prisma.longTermListing.create({
      data: {
        propertyId: property.id,
        status: "DRAFT",
        monthlyPrice: 0,
        marketingTitle: property.name,
        description: "",
        rentalTerms: "",
      },
      include: listingInclude,
    });
    return { listing, created: true as const };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const listing = await prisma.longTermListing.findUnique({
        where: { propertyId: property.id },
        include: listingInclude,
      });
      if (listing) {
        return { listing, created: false as const };
      }
      throw new LongTermListingError("Объект уже добавлен в долгосрочную аренду", "CONFLICT");
    }
    throw error;
  }
}

function listingUpdateData(input: UpdateLongTermListingInput): Prisma.LongTermListingUpdateInput {
  const data: Prisma.LongTermListingUpdateInput = {};

  for (const key of LONG_TERM_UPDATE_KEYS) {
    const value = input[key];
    if (value !== undefined) {
      Object.assign(data, { [key]: value });
    }
  }

  return data;
}

export async function updateLongTermListing(id: string, input: UpdateLongTermListingInput) {
  const current = await getLongTermListingById(id);

  if (!current) {
    throw new LongTermListingError("Карточка долгосрочной аренды не найдена", "NOT_FOUND");
  }

  if (current.status === "ARCHIVED" && input.status !== undefined && input.status !== "ARCHIVED") {
    throw new LongTermListingError("Архивная карточка не может быть восстановлена", "VALIDATION");
  }

  return prisma.longTermListing.update({
    where: { id },
    data: listingUpdateData(input),
    include: listingInclude,
  });
}

export async function archiveLongTermListing(id: string) {
  return updateLongTermListing(id, { status: "ARCHIVED" });
}

export async function replaceLongTermPhotos(id: string, input: LongTermPhotosInput) {
  const current = await getLongTermListingById(id);

  if (!current) {
    throw new LongTermListingError("Карточка долгосрочной аренды не найдена", "NOT_FOUND");
  }

  const photoIds = input.items.map((item) => item.photoId);

  if (photoIds.length !== new Set(photoIds).size) {
    throw new LongTermListingError("Фотография не может быть добавлена дважды", "VALIDATION");
  }

  const photos = await prisma.propertyPhoto.findMany({
    where: { id: { in: photoIds }, propertyId: current.propertyId },
  });

  if (photos.length !== photoIds.length) {
    throw new LongTermListingError("Можно выбирать только фотографии этого объекта", "VALIDATION");
  }

  await prisma.$transaction(async (tx) => {
    await tx.longTermListingPhoto.deleteMany({ where: { listingId: id } });
    if (input.items.length === 0) {
      return;
    }
    await tx.longTermListingPhoto.createMany({
      data: input.items.map((item) => ({
        listingId: id,
        photoId: item.photoId,
        sortOrder: item.sortOrder,
        included: item.included,
      })),
    });
  });

  return getLongTermListingById(id);
}
