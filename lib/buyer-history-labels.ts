import type { BuyerHistoryType } from "@prisma/client";

export const buyerHistoryTypeLabels: Record<BuyerHistoryType, string> = {
  BUYER_CREATED: "Клиент создан",
  BUYER_UPDATED: "Клиент обновлён",
  INTEREST_ADDED: "Добавлен интерес",
  INTEREST_STATUS_CHANGED: "Статус интереса изменён",
  VIEWING_SCHEDULED: "Просмотр назначен",
  VIEWING_COMPLETED: "Просмотр завершён",
  VIEWING_CANCELLED: "Просмотр отменён",
  VIEWING_NO_SHOW: "Неявка на просмотр",
  DEPOSIT_CREATED: "Задаток создан",
  DEPOSIT_PAID: "Задаток оплачен",
  DEPOSIT_REFUNDED: "Задаток возвращён",
  DEPOSIT_FORFEITED: "Задаток удержан",
  PURCHASE_COMPLETED: "Покупка завершена",
  REFUSED: "Отказ",
  NOTE: "Заметка",
};
