import type { PropertyType } from "@prisma/client";
import type { NormalizedLongTermPublicationData } from "@/lib/publications/normalized-long-term";

export const CIAN_CATEGORY_FLAT_RENT = "flatRent" as const;
export const CIAN_FEED_VERSION = 2 as const;
export const CIAN_CURRENCY_RUR = "rur" as const;
export const CIAN_LEASE_TERM_LONG_TERM = "longTerm" as const;

export const CIAN_DESCRIPTION_MIN_LENGTH = 15;
export const CIAN_DESCRIPTION_MAX_LENGTH = 3000;
export const CIAN_PHOTOS_MAX_COUNT = 50;

export const CIAN_SUPPORTED_PROPERTY_TYPES = ["APARTMENT", "STUDIO"] as const satisfies ReadonlyArray<
  Extract<PropertyType, "APARTMENT" | "STUDIO">
>;

export type CianSupportedPropertyType = (typeof CIAN_SUPPORTED_PROPERTY_TYPES)[number];

export type CianPhone = {
  countryCode: string;
  number: string;
};

export type CianPhoto = {
  fullUrl: string;
  isDefault: boolean;
};

export type CianFlatRentPayload = {
  externalId: string;
  category: typeof CIAN_CATEGORY_FLAT_RENT;
  description: string;
  address: string;
  flatRoomsCount: number;
  totalArea: number;
  floorNumber: number;
  buildingFloorsCount: number | null;
  price: number;
  currency: typeof CIAN_CURRENCY_RUR;
  leaseTermType: typeof CIAN_LEASE_TERM_LONG_TERM;
  deposit: number | null;
  phones: CianPhone[];
  photos: CianPhoto[];
};

export type CianIssue = {
  code: string;
  field: string;
  message: string;
};

export type CianValidationResult = {
  valid: boolean;
  errors: CianIssue[];
  warnings: CianIssue[];
};

export type CianPreparedItem =
  | {
      ok: true;
      listingId: string;
      payload: CianFlatRentPayload;
      warnings: CianIssue[];
    }
  | {
      ok: false;
      listingId: string;
      errors: CianIssue[];
      warnings: CianIssue[];
    };

export type CianFeedPreparation = {
  validItems: CianFlatRentPayload[];
  invalidItems: Array<{
    listingId: string;
    errors: CianIssue[];
    warnings: CianIssue[];
  }>;
  warnings: CianIssue[];
};

export class CianSerializationError extends Error {
  readonly code = "CIAN_SERIALIZATION_INVALID";

  constructor(
    message: string,
    readonly errors: CianIssue[],
    readonly warnings: CianIssue[] = [],
  ) {
    super(message);
    this.name = "CianSerializationError";
  }
}

export type { NormalizedLongTermPublicationData };
