import type { DepositStatus, ViewingStatus } from "@prisma/client";

export const viewingStatusLabels: Record<ViewingStatus, string> = {
  SCHEDULED: "Назначен",
  COMPLETED: "Завершён",
  CANCELLED: "Отменён",
  NO_SHOW: "Не явился",
};

export const depositStatusLabels: Record<DepositStatus, string> = {
  PENDING: "Ожидает оплаты",
  PAID: "Оплачен",
  REFUNDED: "Возвращён",
  FORFEITED: "Удержан",
};
