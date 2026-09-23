import {
  isPublicPublicationPhotoUrl,
  parsePublicationPhoneCountryCode,
  parsePublicationPhoneNumber,
  type NormalizedLongTermPublicationData,
} from "@/lib/publications/normalized-long-term";
import {
  CIAN_DESCRIPTION_MAX_LENGTH,
  CIAN_DESCRIPTION_MIN_LENGTH,
  CIAN_PHOTOS_MAX_COUNT,
  CIAN_SUPPORTED_PROPERTY_TYPES,
  type CianIssue,
  type CianSupportedPropertyType,
  type CianValidationResult,
} from "@/lib/publications/providers/cian/types";

const MESSAGES: Record<string, string> = {
  CIAN_UNSUPPORTED_PROPERTY_TYPE: "Тип объекта не поддерживается для CIAN flatRent",
  CIAN_MISSING_ADDRESS: "Нужен адрес для CIAN",
  CIAN_MISSING_FLOOR: "Нужен этаж для CIAN flatRent",
  CIAN_INVALID_PRICE: "Цена для CIAN должна быть больше 0",
  CIAN_DESCRIPTION_TOO_SHORT: "Описание для CIAN короче 15 символов",
  CIAN_DESCRIPTION_TOO_LONG: "Описание для CIAN длиннее 3000 символов",
  CIAN_INVALID_PHONE: "Телефон публикации некорректен для CIAN",
  CIAN_PHOTO_URL_NOT_PUBLIC: "URL фотографии не подходит для CIAN",
  CIAN_TOO_MANY_PHOTOS: "Слишком много фотографий для CIAN (максимум 50)",
  CIAN_INVALID_AREA: "Площадь для CIAN должна быть больше 0",
  CIAN_INVALID_ROOMS: "Число комнат для CIAN должно быть ≥ 0",
  CIAN_COMMISSION_MAPPING_UNRESOLVED: "Комиссия не сопоставлена с ClientFee/AgentFee",
  CIAN_NO_PHOTOS: "Фотографии для CIAN не выбраны",
  CIAN_SPECIAL_OFFER_UNMAPPED: "Спецпредложение не сериализуется в CIAN flatRent",
  CIAN_TITLE_UNMAPPED: "Заголовок не сериализуется в CIAN flatRent на этом этапе",
  CIAN_MINIMUM_RENTAL_PERIOD_UNMAPPED: "Минимальный срок аренды не сопоставлен с полем CIAN",
  CIAN_CONTACT_NAME_UNMAPPED: "Имя контакта публикации не сопоставлено с полем CIAN",
};

function issue(code: keyof typeof MESSAGES, field: string): CianIssue {
  return { code, field, message: MESSAGES[code] };
}

export function isCianSupportedPropertyType(type: string): type is CianSupportedPropertyType {
  return (CIAN_SUPPORTED_PROPERTY_TYPES as readonly string[]).includes(type);
}

function formatAddress(data: NormalizedLongTermPublicationData) {
  const city = data.property.city.trim();
  const address = data.property.address.trim();
  if (!city && !address) {
    return "";
  }
  if (!city) {
    return address;
  }
  if (!address) {
    return city;
  }
  if (address.toLowerCase().includes(city.toLowerCase())) {
    return address;
  }
  return `${city}, ${address}`;
}

/**
 * Provider-specific validation for CIAN Category=flatRent.
 * Separate from baseline validateLongTermPublicationReadiness().
 */
export function validateCianFlatRentPublication(
  data: NormalizedLongTermPublicationData,
): CianValidationResult {
  const errors: CianIssue[] = [];
  const warnings: CianIssue[] = [];

  if (!isCianSupportedPropertyType(data.property.type)) {
    errors.push(issue("CIAN_UNSUPPORTED_PROPERTY_TYPE", "property.type"));
  }

  const address = formatAddress(data);
  if (!address) {
    errors.push(issue("CIAN_MISSING_ADDRESS", "property.address"));
  }

  if (data.property.floor == null) {
    errors.push(issue("CIAN_MISSING_FLOOR", "property.floor"));
  }

  if (!(data.monthlyPrice > 0)) {
    errors.push(issue("CIAN_INVALID_PRICE", "monthlyPrice"));
  }

  const descriptionLength = data.description.trim().length;
  if (descriptionLength < CIAN_DESCRIPTION_MIN_LENGTH) {
    errors.push(issue("CIAN_DESCRIPTION_TOO_SHORT", "description"));
  } else if (descriptionLength > CIAN_DESCRIPTION_MAX_LENGTH) {
    errors.push(issue("CIAN_DESCRIPTION_TOO_LONG", "description"));
  }

  if (!(data.property.area > 0)) {
    errors.push(issue("CIAN_INVALID_AREA", "property.area"));
  }

  if (!(data.property.rooms >= 0) || !Number.isFinite(data.property.rooms)) {
    errors.push(issue("CIAN_INVALID_ROOMS", "property.rooms"));
  }

  const country = data.contact.phoneCountryCode
    ? parsePublicationPhoneCountryCode(data.contact.phoneCountryCode)
    : null;
  const number = data.contact.phoneNumber
    ? parsePublicationPhoneNumber(data.contact.phoneNumber)
    : null;
  if (!country || !number) {
    errors.push(issue("CIAN_INVALID_PHONE", "contact.phoneNumber"));
  }

  if (data.photos.length > CIAN_PHOTOS_MAX_COUNT) {
    errors.push(issue("CIAN_TOO_MANY_PHOTOS", "photos"));
  }

  if (data.photos.length === 0) {
    warnings.push(issue("CIAN_NO_PHOTOS", "photos"));
  } else {
    data.photos.forEach((photo, index) => {
      if (!isPublicPublicationPhotoUrl(photo.url)) {
        errors.push(issue("CIAN_PHOTO_URL_NOT_PUBLIC", `photos[${index}].url`));
      }
    });
  }

  if (data.commissionMapping === "MAPPING_BLOCKED" && data.commission !== 0) {
    warnings.push(issue("CIAN_COMMISSION_MAPPING_UNRESOLVED", "commission"));
  }

  if (data.specialOfferPrice != null || (data.specialOfferText && data.specialOfferText.trim())) {
    warnings.push(issue("CIAN_SPECIAL_OFFER_UNMAPPED", "specialOfferPrice"));
  }

  if (data.title.trim()) {
    warnings.push(issue("CIAN_TITLE_UNMAPPED", "title"));
  }

  if (data.minimumRentalPeriodMonths > 0) {
    warnings.push(issue("CIAN_MINIMUM_RENTAL_PERIOD_UNMAPPED", "minimumRentalPeriodMonths"));
  }

  if (data.contact.name && data.contact.name.trim()) {
    warnings.push(issue("CIAN_CONTACT_NAME_UNMAPPED", "contact.name"));
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function buildCianAddress(data: NormalizedLongTermPublicationData) {
  return formatAddress(data);
}
