import type { BuyerInterestStatus } from "@prisma/client";

export const buyerInterestStatusLabels: Record<BuyerInterestStatus, string> = {
  INTERESTED: "Интересуется",
  VIEWING_REQUESTED: "Запросил просмотр",
  VIEWING_SCHEDULED: "Просмотр назначен",
  VIEWING_COMPLETED: "Просмотр завершён",
  THINKING: "Думает",
  DEPOSIT_PAID: "Задаток внесён",
  PURCHASED: "Покупка",
  REFUSED: "Отказ",
};
