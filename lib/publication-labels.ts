import type { PublicationStatus } from "@prisma/client";

export const publicationStatusLabels: Record<PublicationStatus, string> = {
  NOT_PUBLISHED: "Не опубликовано",
  PUBLISHING: "Публикуется",
  PUBLISHED: "Опубликовано",
  UPDATE_PENDING: "Ожидает обновления",
  UNPUBLISHING: "Снимается с публикации",
  UNPUBLISHED: "Снято с публикации",
  ERROR: "Ошибка",
};
