import type { LongTermListingStatus } from "@prisma/client";

export const longTermStatusLabels: Record<LongTermListingStatus, string> = {
  DRAFT: "Черновик",
  ACTIVE: "Активно",
  PAUSED: "На паузе",
  ARCHIVED: "Архив",
};

export const longTermStatusHint: Record<LongTermListingStatus, string> = {
  DRAFT: "Карточка создана, но не активна",
  ACTIVE: "Объект предлагается в долгосрочную аренду",
  PAUSED: "Временно снят с размещения",
  ARCHIVED: "Больше не используется",
};
