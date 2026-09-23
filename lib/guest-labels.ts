import type { BookingStatus, GuestHistoryType, MessengerType } from "@prisma/client";

export const messengerTypeLabels: Record<MessengerType, string> = {
  MAX: "MAX",
  TELEGRAM: "Telegram",
};

export const guestHistoryTypeLabels: Record<GuestHistoryType, string> = {
  CONTACT: "Обращение",
  BOOKING_CREATED: "Создано бронирование",
  BOOKING_UPDATED: "Бронирование изменено",
  BOOKING_CANCELLED: "Бронирование отменено",
  CHECK_IN: "Заселение",
  CHECK_OUT: "Выселение",
  MESSAGE: "Сообщение",
  NOTE: "Заметка",
};

export const bookingStatusLabels: Record<BookingStatus, string> = {
  PENDING: "Ожидает",
  CONFIRMED: "Подтверждено",
  CANCELLED: "Отменено",
  COMPLETED: "Завершено",
};

export const calendarStatusLegend: Array<{
  status: Exclude<BookingStatus, "CANCELLED">;
  label: string;
}> = [
  { status: "PENDING", label: "Ожидает подтверждения" },
  { status: "CONFIRMED", label: "Подтверждено" },
  { status: "COMPLETED", label: "Завершено" },
];
