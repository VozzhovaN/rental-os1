import type { NormalizedSalePublicationData } from "@/lib/publications/normalized-sale";
import {
  CIAN_CATEGORY_FLAT_SALE,
  CIAN_SALE_CURRENCY_RUR,
  CianSaleSerializationError,
  type CianSaleFeedPreparation,
  type CianSalePayload,
  type CianSalePreparedItem,
} from "@/lib/publications/providers/cian/sale/types";
import {
  buildCianSaleAddress,
  validateCianSalePublication,
} from "@/lib/publications/providers/cian/sale/validation";

/** Stable CIAN ExternalId = SaleListing.id. */
export function resolveCianSaleExternalId(data: NormalizedSalePublicationData) {
  return data.listingId;
}

/**
 * Maps provider-neutral sale DTO → CIAN flatSale payload.
 * Throws when validation has errors (fail closed).
 */
export function mapToCianSalePayload(data: NormalizedSalePublicationData): CianSalePayload {
  const validation = validateCianSalePublication(data);
  if (!validation.valid) {
    throw new CianSaleSerializationError(
      "CIAN flatSale validation failed",
      validation.errors,
      validation.warnings,
    );
  }

  if (data.floor == null) {
    throw new CianSaleSerializationError(
      "CIAN flatSale validation failed",
      validation.errors,
      validation.warnings,
    );
  }

  const countryCode = data.contact.phoneCountryCode!;
  const phoneNumber = data.contact.phoneNumber!;

  return {
    externalId: resolveCianSaleExternalId(data),
    category: CIAN_CATEGORY_FLAT_SALE,
    description: data.description.trim(),
    address: buildCianSaleAddress(data),
    flatRoomsCount: data.rooms,
    totalArea: data.area,
    floorNumber: data.floor,
    buildingFloorsCount: data.floorsTotal,
    price: data.price,
    currency: CIAN_SALE_CURRENCY_RUR,
    phones: [
      {
        countryCode,
        number: phoneNumber,
      },
    ],
    photos: data.photos.map((photo, index) => ({
      fullUrl: photo.url.trim(),
      isDefault: index === 0,
    })),
  };
}

/** Isolates invalid listings without corrupting valid ones. */
export function prepareCianSaleFeedItems(
  items: NormalizedSalePublicationData[],
): CianSaleFeedPreparation {
  const prepared: CianSalePreparedItem[] = items.map((item) => {
    const validation = validateCianSalePublication(item);
    if (!validation.valid) {
      return {
        ok: false as const,
        listingId: item.listingId,
        errors: validation.errors,
        warnings: validation.warnings,
      };
    }

    try {
      return {
        ok: true as const,
        listingId: item.listingId,
        payload: mapToCianSalePayload(item),
        warnings: validation.warnings,
      };
    } catch (error) {
      if (error instanceof CianSaleSerializationError) {
        return {
          ok: false as const,
          listingId: item.listingId,
          errors: error.errors,
          warnings: error.warnings,
        };
      }
      throw error;
    }
  });

  const validItems = prepared.filter((item) => item.ok).map((item) => item.payload);
  const invalidItems = prepared
    .filter((item) => !item.ok)
    .map((item) => ({
      listingId: item.listingId,
      errors: item.errors,
      warnings: item.warnings,
    }));

  const warnings = prepared.flatMap((item) => item.warnings);

  return { validItems, invalidItems, warnings };
}
