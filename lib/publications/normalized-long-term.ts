import { createHash } from "node:crypto";
import type { LongTermListingStatus, PropertyType } from "@prisma/client";

export const COMMISSION_MAPPING_BLOCKED = "MAPPING_BLOCKED" as const;

export type CommissionMappingStatus = typeof COMMISSION_MAPPING_BLOCKED;

export type NormalizedLongTermPublicationPhoto = {
  id: string;
  url: string;
  order: number;
  isPrimary: boolean;
};

export type NormalizedLongTermPublicationData = {
  listingId: string;
  title: string;
  description: string;
  monthlyPrice: number;
  specialOfferPrice: number | null;
  specialOfferText: string | null;
  deposit: number;
  commission: number;
  commissionMapping: CommissionMappingStatus;
  minimumRentalPeriodMonths: number;
  property: {
    address: string;
    city: string;
    district: string;
    floor: number | null;
    totalFloors: number | null;
    rooms: number;
    area: number;
    bedrooms: number;
    bathrooms: number;
    type: PropertyType;
  };
  contact: {
    name: string | null;
    phoneCountryCode: string | null;
    phoneNumber: string | null;
  };
  photos: NormalizedLongTermPublicationPhoto[];
};

export type PublicationListingSource = {
  id: string;
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
  property: {
    type: PropertyType;
    address: string;
    city: string;
    district: string;
    area: number;
    rooms: number;
    bedrooms: number;
    bathrooms: number;
    floor: number | null;
    totalFloors: number | null;
  };
  photos: Array<{
    included: boolean;
    sortOrder: number;
    photo: {
      id: string;
      url: string;
    };
  }>;
};

const DESCRIPTION_BLOCKS: Array<keyof Pick<
  PublicationListingSource,
  | "description"
  | "rentalTerms"
  | "infrastructureDescription"
  | "securityDescription"
  | "parkingDescription"
  | "transportDescription"
  | "advantagesDescription"
>> = [
  "description",
  "rentalTerms",
  "infrastructureDescription",
  "securityDescription",
  "parkingDescription",
  "transportDescription",
  "advantagesDescription",
];

export function mergeLongTermPublicationDescription(listing: PublicationListingSource) {
  return DESCRIPTION_BLOCKS.map((key) => listing[key].trim())
    .filter((block) => block.length > 0)
    .join("\n\n");
}

export function parsePublicationPhoneCountryCode(raw: string): string | null {
  const compact = raw.trim().replace(/\s+/g, "");
  if (!compact) {
    return null;
  }

  const digits = compact.startsWith("+") ? compact.slice(1) : compact;
  if (!/^\d{1,3}$/.test(digits)) {
    return null;
  }

  return digits;
}

export function parsePublicationPhoneNumber(raw: string): string | null {
  const compact = raw.trim().replace(/\s+/g, "");
  if (!compact) {
    return null;
  }

  if (!/^\d{6,15}$/.test(compact)) {
    return null;
  }

  return compact;
}

export function isPublicPublicationPhotoUrl(url: string) {
  let parsed: URL;

  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") {
    return false;
  }

  return !isPrivateOrLocalHost(parsed.hostname);
}

function isPrivateOrLocalHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    return true;
  }

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) {
    return false;
  }

  const octets = ipv4.slice(1).map(Number);
  if (octets.some((part) => part > 255)) {
    return false;
  }

  const [a, b] = octets;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31)
  );
}

function selectedPhotos(listing: PublicationListingSource): NormalizedLongTermPublicationPhoto[] {
  return listing.photos
    .filter((item) => item.included)
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.photo.id.localeCompare(right.photo.id))
    .map((item, index) => ({
      id: item.photo.id,
      url: item.photo.url,
      order: item.sortOrder,
      isPrimary: index === 0,
    }));
}

/**
 * Собирает provider-neutral DTO из актуальных данных карточки.
 * Без записи в БД, без смены Publication.status, без XML и HTTP.
 */
export function buildNormalizedLongTermPublicationData(
  listing: PublicationListingSource,
): NormalizedLongTermPublicationData {
  return {
    listingId: listing.id,
    title: listing.marketingTitle.trim(),
    description: mergeLongTermPublicationDescription(listing),
    monthlyPrice: listing.monthlyPrice,
    specialOfferPrice: listing.specialOfferPrice,
    specialOfferText: listing.specialOfferText,
    deposit: listing.deposit,
    commission: listing.commission,
    commissionMapping: COMMISSION_MAPPING_BLOCKED,
    minimumRentalPeriodMonths: listing.minimumRentalPeriod,
    property: {
      address: listing.property.address,
      city: listing.property.city,
      district: listing.property.district,
      floor: listing.property.floor,
      totalFloors: listing.property.totalFloors,
      rooms: listing.property.rooms,
      area: listing.property.area,
      bedrooms: listing.property.bedrooms,
      bathrooms: listing.property.bathrooms,
      type: listing.property.type,
    },
    contact: {
      name: listing.publicationContactName,
      phoneCountryCode: listing.publicationPhoneCountryCode,
      phoneNumber: listing.publicationPhoneNumber,
    },
    photos: selectedPhotos(listing),
  };
}

function canonicalizeNormalizedLongTermPublicationData(data: NormalizedLongTermPublicationData) {
  return {
    listingId: data.listingId,
    title: data.title,
    description: data.description,
    monthlyPrice: data.monthlyPrice,
    specialOfferPrice: data.specialOfferPrice,
    specialOfferText: data.specialOfferText,
    deposit: data.deposit,
    commission: data.commission,
    commissionMapping: data.commissionMapping,
    minimumRentalPeriodMonths: data.minimumRentalPeriodMonths,
    property: {
      address: data.property.address,
      city: data.property.city,
      district: data.property.district,
      floor: data.property.floor,
      totalFloors: data.property.totalFloors,
      rooms: data.property.rooms,
      area: data.property.area,
      bedrooms: data.property.bedrooms,
      bathrooms: data.property.bathrooms,
      type: data.property.type,
    },
    contact: {
      name: data.contact.name,
      phoneCountryCode: data.contact.phoneCountryCode,
      phoneNumber: data.contact.phoneNumber,
    },
    photos: data.photos.map((photo) => ({
      id: photo.id,
      url: photo.url,
      order: photo.order,
      isPrimary: photo.isPrimary,
    })),
  };
}

export function hashNormalizedLongTermPublicationData(data: NormalizedLongTermPublicationData) {
  const payload = JSON.stringify(canonicalizeNormalizedLongTermPublicationData(data));
  return createHash("sha256").update(payload).digest("hex");
}
