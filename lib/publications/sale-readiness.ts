import {
  buildNormalizedSalePublicationData,
  isPublicPublicationPhotoUrl,
  parsePublicationPhoneCountryCode,
  parsePublicationPhoneNumber,
  type NormalizedSalePublicationData,
  type SalePublicationListingSource,
} from "@/lib/publications/normalized-sale";
import type { PublicationReadinessIssue, PublicationReadinessResult } from "@/lib/publications/readiness";

const FLOOR_REQUIRED_PROPERTY_TYPES = new Set(["APARTMENT", "STUDIO"]);

const MESSAGES: Record<string, string> = {
  LISTING_SOLD: "Объект продан. Новая публикация недоступна; требуется снятие с площадки",
  LISTING_ARCHIVED: "Карточка продажи в архиве",
  INVALID_PRICE: "Цена продажи должна быть больше 0",
  MISSING_DESCRIPTION: "Нужно заполнить описание объявления",
  MISSING_ADDRESS: "Нужно указать адрес объекта",
  INVALID_AREA: "Площадь объекта должна быть больше 0",
  MISSING_FLOOR: "Нужно указать этаж объекта",
  MISSING_PUBLICATION_CONTACT: "Нужно указать контакт для публикации",
  INVALID_PUBLICATION_PHONE: "Телефон для публикации указан некорректно",
  PHOTO_URL_NOT_PUBLIC: "Ссылка на фотографию не подходит для публикации",
  MISSING_PHOTOS: "Фотографии для объявления не выбраны",
  EMPTY_TITLE: "Не заполнен заголовок объявления",
  MISSING_COORDINATES: "Координаты объекта не заданы",
};

function issue(code: keyof typeof MESSAGES, field: string): PublicationReadinessIssue {
  return { code, field, message: MESSAGES[code] };
}

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

/**
 * Baseline sale publication readiness. Not provider-specific mapping.
 */
export function validateSalePublicationReadiness(
  listing: SalePublicationListingSource,
  normalized: NormalizedSalePublicationData = buildNormalizedSalePublicationData(listing),
): PublicationReadinessResult {
  const errors: PublicationReadinessIssue[] = [];
  const warnings: PublicationReadinessIssue[] = [];

  if (listing.status === "SOLD") {
    errors.push(issue("LISTING_SOLD", "status"));
  }

  if (listing.status === "ARCHIVED") {
    errors.push(issue("LISTING_ARCHIVED", "status"));
  }

  if (!(listing.price > 0)) {
    errors.push(issue("INVALID_PRICE", "price"));
  }

  if (!hasText(listing.description)) {
    errors.push(issue("MISSING_DESCRIPTION", "description"));
  }

  if (!hasText(listing.property.address) || !hasText(listing.property.city)) {
    errors.push(issue("MISSING_ADDRESS", "property.address"));
  }

  if (!(listing.property.area > 0)) {
    errors.push(issue("INVALID_AREA", "property.area"));
  }

  if (FLOOR_REQUIRED_PROPERTY_TYPES.has(listing.property.type) && listing.property.floor == null) {
    errors.push(issue("MISSING_FLOOR", "property.floor"));
  }

  const contactName = listing.publicationContactName?.trim() ?? "";
  const rawCountry = listing.publicationPhoneCountryCode?.trim() ?? "";
  const rawNumber = listing.publicationPhoneNumber?.trim() ?? "";

  if (!contactName || !rawCountry || !rawNumber) {
    errors.push(issue("MISSING_PUBLICATION_CONTACT", "contact"));
  } else if (
    !parsePublicationPhoneCountryCode(rawCountry) ||
    !parsePublicationPhoneNumber(rawNumber)
  ) {
    errors.push(issue("INVALID_PUBLICATION_PHONE", "contact.phoneNumber"));
  }

  if (normalized.photos.length === 0) {
    warnings.push(issue("MISSING_PHOTOS", "photos"));
  } else {
    normalized.photos.forEach((photo, index) => {
      if (!isPublicPublicationPhotoUrl(photo.url)) {
        errors.push(issue("PHOTO_URL_NOT_PUBLIC", `photos[${index}].url`));
      }
    });
  }

  if (!normalized.title) {
    warnings.push(issue("EMPTY_TITLE", "marketingTitle"));
  }

  if (normalized.coordinates == null) {
    warnings.push(issue("MISSING_COORDINATES", "coordinates"));
  }

  return {
    ready: errors.length === 0,
    errors,
    warnings,
  };
}

export function getSalePublicationReadiness(listing: SalePublicationListingSource) {
  const normalized = buildNormalizedSalePublicationData(listing);
  return {
    normalized,
    readiness: validateSalePublicationReadiness(listing, normalized),
    payloadHash: null as string | null,
  };
}

/** Stage 10.1: providers not mapped yet. */
export const SALE_PROVIDER_MAPPING_STATUS = "CORE_READY_PROVIDER_MAPPING_PENDING" as const;
