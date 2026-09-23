import {
  buildNormalizedLongTermPublicationData,
  isPublicPublicationPhotoUrl,
  parsePublicationPhoneCountryCode,
  parsePublicationPhoneNumber,
  type NormalizedLongTermPublicationData,
  type PublicationListingSource,
} from "@/lib/publications/normalized-long-term";

export type PublicationReadinessIssue = {
  code: string;
  field: string;
  message: string;
};

export type PublicationReadinessResult = {
  ready: boolean;
  errors: PublicationReadinessIssue[];
  warnings: PublicationReadinessIssue[];
};

const FLOOR_REQUIRED_PROPERTY_TYPES = new Set(["APARTMENT", "STUDIO"]);

const MESSAGES: Record<string, string> = {
  LISTING_ARCHIVED: "Карточка в архиве",
  INVALID_MONTHLY_PRICE: "Цена в месяц должна быть больше 0",
  MISSING_DESCRIPTION: "Нужно заполнить описание объявления",
  MISSING_PUBLICATION_CONTACT: "Нужно указать контакт для публикации",
  INVALID_PUBLICATION_PHONE: "Телефон для публикации указан некорректно",
  MISSING_FLOOR: "Нужно указать этаж объекта",
  MISSING_ADDRESS: "Нужно указать адрес объекта",
  INVALID_AREA: "Площадь объекта должна быть больше 0",
  PHOTO_URL_NOT_PUBLIC: "Ссылка на фотографию не подходит для публикации",
  MISSING_PHOTOS: "Фотографии для объявления не выбраны",
  EMPTY_TITLE: "Не заполнен заголовок объявления",
  COMMISSION_MAPPING_UNRESOLVED: "Комиссия карточки сохранена, но не сопоставлена с комиссией площадки",
};

function issue(code: keyof typeof MESSAGES, field: string): PublicationReadinessIssue {
  return { code, field, message: MESSAGES[code] };
}

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

/**
 * Базовая готовность данных к будущему publication pipeline.
 * Не проверяет требования конкретной площадки.
 */
export function validateLongTermPublicationReadiness(
  listing: PublicationListingSource,
  normalized: NormalizedLongTermPublicationData = buildNormalizedLongTermPublicationData(listing),
): PublicationReadinessResult {
  const errors: PublicationReadinessIssue[] = [];
  const warnings: PublicationReadinessIssue[] = [];

  if (listing.status === "ARCHIVED") {
    errors.push(issue("LISTING_ARCHIVED", "status"));
  }

  if (!(listing.monthlyPrice > 0)) {
    errors.push(issue("INVALID_MONTHLY_PRICE", "monthlyPrice"));
  }

  if (!listing.description.trim()) {
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
  } else if (!parsePublicationPhoneCountryCode(rawCountry) || !parsePublicationPhoneNumber(rawNumber)) {
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

  if (listing.commission !== 0) {
    warnings.push(issue("COMMISSION_MAPPING_UNRESOLVED", "commission"));
  }

  return {
    ready: errors.length === 0,
    errors,
    warnings,
  };
}

export function getLongTermPublicationReadiness(listing: PublicationListingSource) {
  const normalized = buildNormalizedLongTermPublicationData(listing);
  return {
    normalized,
    readiness: validateLongTermPublicationReadiness(listing, normalized),
  };
}
