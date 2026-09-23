import type {
  PresentationKind,
  PresentationSectionType,
  PresentationStatus,
} from "@prisma/client";

export const presentationKindLabels: Record<PresentationKind, string> = {
  SHORT_TERM: "Посуточная аренда",
  LONG_TERM: "Долгосрочная аренда",
  SALE: "Продажа",
  COLLECTION: "Подборка",
};

export const presentationStatusLabels: Record<PresentationStatus, string> = {
  DRAFT: "Черновик",
  READY: "Готова",
  PUBLISHED: "Опубликована",
  ARCHIVED: "В архиве",
};

export const presentationSectionTypeLabels: Record<
  PresentationSectionType,
  string
> = {
  DESCRIPTION: "Об объекте",
  ADVANTAGES: "Преимущества",
  INFRASTRUCTURE: "Инфраструктура",
  AMENITIES: "Удобства",
  LOCATION: "Расположение",
  CONDITIONS: "Условия",
  LAYOUT: "Планировка",
  COMMUNICATIONS: "Коммуникации",
  SECURITY: "Безопасность",
  CUSTOM: "Свой раздел",
};
