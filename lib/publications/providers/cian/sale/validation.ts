import {
  isPublicPublicationPhotoUrl,
  parsePublicationPhoneCountryCode,
  parsePublicationPhoneNumber,
  type NormalizedSalePublicationData,
} from "@/lib/publications/normalized-sale";
import type { CianIssue } from "@/lib/publications/providers/cian/types";
import {
  CIAN_SALE_DESCRIPTION_MAX_LENGTH,
  CIAN_SALE_DESCRIPTION_MIN_LENGTH,
  CIAN_SALE_PHOTOS_MAX_COUNT,
  CIAN_SALE_SUPPORTED_PROPERTY_TYPES,
  type CianSaleSupportedPropertyType,
  type CianSaleValidationResult,
} from "@/lib/publications/providers/cian/sale/types";

const MESSAGES: Record<string, string> = {
  CIAN_UNSUPPORTED_PROPERTY_TYPE: "Тип объекта не поддерживается для CIAN flatSale",
  CIAN_SALE_CATEGORY_UNCONFIRMED: "Категория CIAN sale не подтверждена",
  CIAN_INVALID_DESCRIPTION: "Описание для CIAN sale некорректно (15–3000 символов)",
  CIAN_INVALID_ROOMS: "Число комнат для CIAN sale должно быть ≥ 0",
  CIAN_MISSING_AREA: "Нужна площадь для CIAN sale",
  CIAN_INVALID_AREA: "Площадь для CIAN sale должна быть больше 0",
  CIAN_MISSING_FLOOR: "Нужен этаж для CIAN flatSale",
  CIAN_INVALID_FLOOR: "Этаж для CIAN sale указан некорректно",
  CIAN_MISSING_BUILDING_FLOORS: "Этажность здания не указана",
  CIAN_INVALID_PRICE: "Цена продажи для CIAN должна быть больше 0",
  CIAN_INVALID_PHONE: "Телефон публикации некорректен для CIAN",
  CIAN_INVALID_PHOTO: "URL фотографии не подходит для CIAN",
  CIAN_TOO_MANY_PHOTOS: "Слишком много фотографий для CIAN (максимум 50)",
  CIAN_MISSING_ADDRESS: "Нужен адрес для CIAN sale",
  CIAN_NO_PHOTOS: "Фотографии для CIAN sale не выбраны",
  CIAN_SPECIAL_OFFER_UNMAPPED: "Спецпредложение не сериализуется в CIAN flatSale",
  CIAN_TITLE_UNMAPPED: "Заголовок не сериализуется в CIAN flatSale на этом этапе",
  CIAN_CONTACT_NAME_UNMAPPED: "Имя контакта публикации не сопоставлено с полем CIAN",
  CIAN_MISSING_COORDINATES: "Координаты объекта отсутствуют — тег Coordinates не сериализуется",
};

function issue(code: keyof typeof MESSAGES, field: string): CianIssue {
  return { code, field, message: MESSAGES[code] };
}

export function isCianSaleSupportedPropertyType(
  type: string,
): type is CianSaleSupportedPropertyType {
  return (CIAN_SALE_SUPPORTED_PROPERTY_TYPES as readonly string[]).includes(type);
}

export function buildCianSaleAddress(data: NormalizedSalePublicationData) {
  const city = data.city.trim();
  const address = data.address.trim();
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
 * Provider-specific validation for CIAN Category=flatSale.
 * Separate from baseline validateSalePublicationReadiness().
 */
export function validateCianSalePublication(
  data: NormalizedSalePublicationData,
): CianSaleValidationResult {
  const errors: CianIssue[] = [];
  const warnings: CianIssue[] = [];

  if (!isCianSaleSupportedPropertyType(data.propertyType)) {
    errors.push(issue("CIAN_UNSUPPORTED_PROPERTY_TYPE", "propertyType"));
  }

  const address = buildCianSaleAddress(data);
  if (!address) {
    errors.push(issue("CIAN_MISSING_ADDRESS", "address"));
  }

  if (data.floor == null) {
    errors.push(issue("CIAN_MISSING_FLOOR", "floor"));
  } else if (!Number.isFinite(data.floor) || data.floor < 0) {
    errors.push(issue("CIAN_INVALID_FLOOR", "floor"));
  }

  if (!(data.price > 0)) {
    errors.push(issue("CIAN_INVALID_PRICE", "price"));
  }

  const descriptionLength = data.description.trim().length;
  if (
    descriptionLength < CIAN_SALE_DESCRIPTION_MIN_LENGTH ||
    descriptionLength > CIAN_SALE_DESCRIPTION_MAX_LENGTH
  ) {
    errors.push(issue("CIAN_INVALID_DESCRIPTION", "description"));
  }

  if (data.area == null || data.area === 0) {
    errors.push(issue("CIAN_MISSING_AREA", "area"));
  } else if (!(data.area > 0) || !Number.isFinite(data.area)) {
    errors.push(issue("CIAN_INVALID_AREA", "area"));
  }

  if (!(data.rooms >= 0) || !Number.isFinite(data.rooms)) {
    errors.push(issue("CIAN_INVALID_ROOMS", "rooms"));
  }

  if (data.floorsTotal == null) {
    warnings.push(issue("CIAN_MISSING_BUILDING_FLOORS", "floorsTotal"));
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

  if (data.photos.length > CIAN_SALE_PHOTOS_MAX_COUNT) {
    errors.push(issue("CIAN_INVALID_PHOTO", "photos"));
    errors.push(issue("CIAN_TOO_MANY_PHOTOS", "photos"));
  }

  if (data.photos.length === 0) {
    warnings.push(issue("CIAN_NO_PHOTOS", "photos"));
  } else {
    data.photos.forEach((photo, index) => {
      if (!isPublicPublicationPhotoUrl(photo.url)) {
        errors.push(issue("CIAN_INVALID_PHOTO", `photos[${index}].url`));
      }
    });
  }

  if (data.specialOfferPrice != null || (data.specialOfferText && data.specialOfferText.trim())) {
    warnings.push(issue("CIAN_SPECIAL_OFFER_UNMAPPED", "specialOfferPrice"));
  }

  if (data.title.trim()) {
    warnings.push(issue("CIAN_TITLE_UNMAPPED", "title"));
  }

  if (data.contact.name && data.contact.name.trim()) {
    warnings.push(issue("CIAN_CONTACT_NAME_UNMAPPED", "contact.name"));
  }

  if (data.coordinates == null) {
    warnings.push(issue("CIAN_MISSING_COORDINATES", "coordinates"));
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
