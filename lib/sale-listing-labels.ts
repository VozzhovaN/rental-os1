import type { SaleListingStatus } from "@prisma/client";

export const saleListingStatusLabels: Record<SaleListingStatus, string> = {
  DRAFT: "Черновик",
  ACTIVE: "Активен",
  PAUSED: "Приостановлен",
  SOLD: "Продан",
  ARCHIVED: "Архив",
};

export const saleListingStatusHint: Record<SaleListingStatus, string> = {
  DRAFT: "Карточка создана, но ещё не предлагается к продаже",
  ACTIVE: "Объект активно предлагается к продаже",
  PAUSED: "Временно снят с продажи",
  SOLD: "Сделка завершена (устанавливается workflow покупки)",
  ARCHIVED: "Убрано из активного контура продаж",
};
