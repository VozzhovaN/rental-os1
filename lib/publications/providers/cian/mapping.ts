import type { NormalizedLongTermPublicationData } from "@/lib/publications/normalized-long-term";
import {
  CIAN_CATEGORY_FLAT_RENT,
  CIAN_CURRENCY_RUR,
  CIAN_LEASE_TERM_LONG_TERM,
  CianSerializationError,
  type CianFlatRentPayload,
  type CianFeedPreparation,
  type CianPreparedItem,
} from "@/lib/publications/providers/cian/types";
import {
  buildCianAddress,
  validateCianFlatRentPublication,
} from "@/lib/publications/providers/cian/validation";

/**
 * Stable CIAN ExternalId = LongTermListing.id (normalized listingId).
 * Not written to Publication.externalId on this stage.
 */
export function resolveCianExternalId(data: NormalizedLongTermPublicationData) {
  return data.listingId;
}

/**
 * Maps provider-neutral DTO → CIAN flatRent payload.
 * Throws CianSerializationError when validation has errors (fail closed).
 */
export function mapToCianFlatRentPayload(data: NormalizedLongTermPublicationData): CianFlatRentPayload {
  const validation = validateCianFlatRentPublication(data);
  if (!validation.valid) {
    throw new CianSerializationError(
      "CIAN flatRent validation failed",
      validation.errors,
      validation.warnings,
    );
  }

  if (data.property.floor == null) {
    throw new CianSerializationError(
      "CIAN flatRent validation failed",
      validation.errors,
      validation.warnings,
    );
  }

  const countryCode = data.contact.phoneCountryCode!;
  const phoneNumber = data.contact.phoneNumber!;

  return {
    externalId: resolveCianExternalId(data),
    category: CIAN_CATEGORY_FLAT_RENT,
    description: data.description.trim(),
    address: buildCianAddress(data),
    flatRoomsCount: data.property.rooms,
    totalArea: data.property.area,
    floorNumber: data.property.floor,
    buildingFloorsCount: data.property.totalFloors,
    price: data.monthlyPrice,
    currency: CIAN_CURRENCY_RUR,
    leaseTermType: CIAN_LEASE_TERM_LONG_TERM,
    deposit: data.deposit > 0 ? data.deposit : null,
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

/**
 * Isolates invalid listings without corrupting valid ones.
 * Low-level serializeCianFeed() still requires only valid payloads.
 */
export function prepareCianFeedItems(
  items: NormalizedLongTermPublicationData[],
): CianFeedPreparation {
  const prepared: CianPreparedItem[] = items.map((item) => {
    const validation = validateCianFlatRentPublication(item);
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
        payload: mapToCianFlatRentPayload(item),
        warnings: validation.warnings,
      };
    } catch (error) {
      if (error instanceof CianSerializationError) {
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
