import type { IntegrationStatus, SyncDirection, SyncEntityType, SyncLogStatus } from "@prisma/client";

export const integrationStatusLabels: Record<IntegrationStatus, string> = {
  DISCONNECTED: "Не подключено",
  CONNECTING: "Подключение",
  CONNECTED: "Подключено",
  SYNCING: "Синхронизация",
  ERROR: "Ошибка",
};

export const syncDirectionLabels: Record<SyncDirection, string> = {
  IMPORT: "Импорт",
  EXPORT: "Экспорт",
};

export const syncEntityTypeLabels: Record<SyncEntityType, string> = {
  LISTING: "Объявление",
  BOOKING: "Бронирование",
  AVAILABILITY: "Занятость",
  PRICE: "Цена",
};

export const syncLogStatusLabels: Record<SyncLogStatus, string> = {
  STARTED: "Запущено",
  SUCCESS: "Успешно",
  ERROR: "Ошибка",
  SKIPPED: "Пропущено",
};

export const providerDisplayNames: Record<string, string> = {
  AVITO: "Авито",
  CIAN: "ЦИАН",
  DOMCLICK: "Домклик",
};
