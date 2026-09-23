import type {
  ManagementType,
  PropertyStatus,
  PropertyType,
} from "@prisma/client";

export const propertyTypeLabels: Record<PropertyType, string> = {
  APARTMENT: "Квартира",
  HOUSE: "Дом",
  STUDIO: "Студия",
  OTHER: "Другое",
};

export const propertyStatusLabels: Record<PropertyStatus, string> = {
  ACTIVE: "Активен",
  INACTIVE: "Неактивен",
  ARCHIVED: "В архиве",
};

export const managementTypeLabels: Record<ManagementType, string> = {
  OWN: "Собственный",
  COMMISSION: "Комиссия",
};

export function formatMoney(value: number | null) {
  if (value == null) {
    return "—";
  }

  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

export function formatArea(value: number) {
  return `${value} м²`;
}

export function formatPercent(value: number | null) {
  if (value == null) {
    return "—";
  }

  return `${value} %`;
}
