import { createHash } from "node:crypto";
import type { PropertyType, SaleListingStatus } from "@prisma/client";
import {
  isPublicPublicationPhotoUrl,
  parsePublicationPhoneCountryCode,
  parsePublicationPhoneNumber,
} from "@/lib/publications/normalized-long-term";

export type NormalizedSalePublicationPhoto = {
  id: string;
  url: string;
  order: number;
  isPrimary: boolean;
};

export type NormalizedSalePublicationData = {
  listingId: string;
  propertyId: string;
  title: string;
  description: string;
  price: number;
  specialOfferPrice: number | null;
  specialOfferText: string | null;
  address: string;
  city: string;
  district: string;
  coordinates: null;
  propertyType: PropertyType;
  rooms: number;
  area: number;
  floor: number | null;
  floorsTotal: number | null;
  contact: {
    name: string | null;
    phoneCountryCode: string | null;
    phoneNumber: string | null;
  };
  photos: NormalizedSalePublicationPhoto[];
  advantages: string | null;
  infrastructure: string | null;
  security: string | null;
  parking: string | null;
  transport: string | null;
};

export type SalePublicationListingSource = {
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
  property: {
    type: PropertyType;
    address: string;
    city: string;
    district: string;
    area: number;
    rooms: number;
    floor: number | null;
    totalFloors: number | null;
  };
  photos: Array<{
    order: number;
    propertyPhoto: {
      id: string;
      url: string;
    };
  }>;
};

function mergeSaleDescription(listing: SalePublicationListingSource) {
  const blocks = [
    listing.description,
    listing.advantages,
    listing.infrastructure,
    listing.security,
    listing.parking,
    listing.transport,
  ];
  return blocks
    .map((block) => (block ?? "").trim())
    .filter((block) => block.length > 0)
    .join("\n\n");
}

function selectedPhotos(listing: SalePublicationListingSource): NormalizedSalePublicationPhoto[] {
  return listing.photos
    .slice()
    .sort(
      (left, right) =>
        left.order - right.order ||
        left.propertyPhoto.id.localeCompare(right.propertyPhoto.id),
    )
    .map((item, index) => ({
      id: item.propertyPhoto.id,
      url: item.propertyPhoto.url,
      order: item.order,
      isPrimary: index === 0,
    }));
}

/**
 * Provider-neutral sale publication DTO.
 * No DB writes, no SalePublication.status changes, no provider HTTP/XML.
 */
export function buildNormalizedSalePublicationData(
  listing: SalePublicationListingSource,
): NormalizedSalePublicationData {
  return {
    listingId: listing.id,
    propertyId: listing.propertyId,
    title: (listing.marketingTitle ?? "").trim(),
    description: mergeSaleDescription(listing),
    price: listing.price,
    specialOfferPrice: listing.specialOfferPrice,
    specialOfferText: listing.specialOfferText,
    address: listing.property.address,
    city: listing.property.city,
    district: listing.property.district,
    coordinates: null,
    propertyType: listing.property.type,
    rooms: listing.property.rooms,
    area: listing.property.area,
    floor: listing.property.floor,
    floorsTotal: listing.property.totalFloors,
    contact: {
      name: listing.publicationContactName,
      phoneCountryCode: listing.publicationPhoneCountryCode,
      phoneNumber: listing.publicationPhoneNumber,
    },
    photos: selectedPhotos(listing),
    advantages: listing.advantages,
    infrastructure: listing.infrastructure,
    security: listing.security,
    parking: listing.parking,
    transport: listing.transport,
  };
}

function canonicalizeNormalizedSalePublicationData(data: NormalizedSalePublicationData) {
  return {
    listingId: data.listingId,
    propertyId: data.propertyId,
    title: data.title,
    description: data.description,
    price: data.price,
    specialOfferPrice: data.specialOfferPrice,
    specialOfferText: data.specialOfferText,
    address: data.address,
    city: data.city,
    district: data.district,
    coordinates: data.coordinates,
    propertyType: data.propertyType,
    rooms: data.rooms,
    area: data.area,
    floor: data.floor,
    floorsTotal: data.floorsTotal,
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
    advantages: data.advantages,
    infrastructure: data.infrastructure,
    security: data.security,
    parking: data.parking,
    transport: data.transport,
  };
}

export function hashNormalizedSalePublicationData(data: NormalizedSalePublicationData) {
  const payload = JSON.stringify(canonicalizeNormalizedSalePublicationData(data));
  return createHash("sha256").update(payload).digest("hex");
}

export {
  isPublicPublicationPhotoUrl,
  parsePublicationPhoneCountryCode,
  parsePublicationPhoneNumber,
};
