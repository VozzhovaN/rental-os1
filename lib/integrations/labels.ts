import type { IntegrationStatus, SyncDirection, SyncEntityType, SyncLogStatus } from "@prisma/client";

export const integrationStatusLabels: Record<IntegrationStatus, string> = {
  DISCONNECTED: "Не подключено",
  CONNECTING: "Подключение",
  CONNECTED: "Подключено",
  SYNCING: "Синхронизация",
  ERROR: "Ошибка",
};

export const syncDirectionLabels: Record<SyncDirection, string> = {
  IMPORT: "IMPORT",
  EXPORT: "EXPORT",
};

export const syncEntityTypeLabels: Record<SyncEntityType, string> = {
  LISTING: "Listing",
  BOOKING: "Booking",
  AVAILABILITY: "Availability",
  PRICE: "Price",
};

export const syncLogStatusLabels: Record<SyncLogStatus, string> = {
  STARTED: "STARTED",
  SUCCESS: "SUCCESS",
  ERROR: "ERROR",
  SKIPPED: "SKIPPED",
};
