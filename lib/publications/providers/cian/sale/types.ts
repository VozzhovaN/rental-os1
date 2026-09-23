import type { PropertyType } from "@prisma/client";
import type { NormalizedSalePublicationData } from "@/lib/publications/normalized-sale";
import type { CianIssue, CianPhone, CianPhoto } from "@/lib/publications/providers/cian/types";

/** Official CIAN secondary apartment sale category: https://www.cian.ru/xml_import/doc/#flatSale */
export const CIAN_CATEGORY_FLAT_SALE = "flatSale" as const;

export const CIAN_SALE_FEED_VERSION = 2 as const;
export const CIAN_SALE_CURRENCY_RUR = "rur" as const;

export const CIAN_SALE_DESCRIPTION_MIN_LENGTH = 15;
export const CIAN_SALE_DESCRIPTION_MAX_LENGTH = 3000;
export const CIAN_SALE_PHOTOS_MAX_COUNT = 50;

export const CIAN_SALE_SUPPORTED_PROPERTY_TYPES = [
  "APARTMENT",
  "STUDIO",
] as const satisfies ReadonlyArray<Extract<PropertyType, "APARTMENT" | "STUDIO">>;

export type CianSaleSupportedPropertyType = (typeof CIAN_SALE_SUPPORTED_PROPERTY_TYPES)[number];

/**
 * Intermediate CIAN sale payload (Category=flatSale).
 * No LeaseTermType / Deposit — those are rent-only BargainTerms fields.
 */
export type CianSalePayload = {
  externalId: string;
  category: typeof CIAN_CATEGORY_FLAT_SALE;
  description: string;
  address: string;
  flatRoomsCount: number;
  totalArea: number;
  floorNumber: number;
  buildingFloorsCount: number | null;
  price: number;
  currency: typeof CIAN_SALE_CURRENCY_RUR;
  phones: CianPhone[];
  photos: CianPhoto[];
};

export type CianSaleValidationResult = {
  valid: boolean;
  errors: CianIssue[];
  warnings: CianIssue[];
};

export type CianSalePreparedItem =
  | {
      ok: true;
      listingId: string;
      payload: CianSalePayload;
      warnings: CianIssue[];
    }
  | {
      ok: false;
      listingId: string;
      errors: CianIssue[];
      warnings: CianIssue[];
    };

export type CianSaleFeedPreparation = {
  validItems: CianSalePayload[];
  invalidItems: Array<{
    listingId: string;
    errors: CianIssue[];
    warnings: CianIssue[];
  }>;
  warnings: CianIssue[];
};

export class CianSaleSerializationError extends Error {
  readonly code = "CIAN_SALE_SERIALIZATION_INVALID";

  constructor(
    message: string,
    readonly errors: CianIssue[],
    readonly warnings: CianIssue[] = [],
  ) {
    super(message);
    this.name = "CianSaleSerializationError";
  }
}

export type { NormalizedSalePublicationData, CianIssue };
