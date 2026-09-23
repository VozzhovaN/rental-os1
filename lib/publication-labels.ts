import type { PublicationStatus } from "@prisma/client";

export const publicationStatusLabels: Record<PublicationStatus, string> = {
  NOT_PUBLISHED: "Не опубликовано",
  PUBLISHING: "Подготовка публикации",
  PUBLISHED: "Опубликовано",
  UPDATE_PENDING: "Требуется обновление",
  UNPUBLISHING: "Снимается с публикации",
  UNPUBLISHED: "Снято с публикации",
  ERROR: "Ошибка",
};
