import { z } from "zod";
import { emptyToNull } from "@/lib/format";

export const MESSENGER_TYPES = ["MAX", "TELEGRAM"] as const;
export const GUEST_HISTORY_TYPES = [
  "CONTACT",
  "BOOKING_CREATED",
  "BOOKING_UPDATED",
  "BOOKING_CANCELLED",
  "CHECK_IN",
  "CHECK_OUT",
  "MESSAGE",
  "NOTE",
] as const;
export const MANUAL_HISTORY_TYPES = ["CONTACT", "MESSAGE", "NOTE"] as const;
export const BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
] as const;

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((value) => emptyToNull(value ?? undefined));

export const createGuestSchema = z.object({
  firstName: z.string().trim().min(1, "Укажите имя").max(100),
  lastName: optionalText,
  middleName: optionalText,
  phone: optionalText.refine(
    (value) => value === null || /^\+?[0-9\s()-]{10,20}$/.test(value),
    "Некорректный телефон",
  ),
  email: optionalText.refine(
    (value) => value === null || z.string().email().safeParse(value).success,
    "Некорректный email",
  ),
  messengerType: z.enum(MESSENGER_TYPES).nullable().optional(),
  messengerContact: optionalText,
  comment: optionalText,
}).strict();

export const updateGuestSchema = createGuestSchema.partial();

export const createGuestHistorySchema = z.object({
  type: z.enum(MANUAL_HISTORY_TYPES, { message: "Укажите тип записи" }),
  title: z.string().trim().min(1, "Укажите заголовок").max(200),
  description: optionalText,
}).strict();

const dateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату в формате ГГГГ-ММ-ДД");

export const createBookingSchema = z.object({
  propertyId: z.string().trim().min(1, "Укажите объект"),
  guestId: z.string().trim().min(1, "Укажите гостя"),
  salesChannelId: z.string().trim().min(1, "Укажите канал продаж"),
  channelListingId: optionalText.optional(),
  checkIn: dateOnly,
  checkOut: dateOnly,
  guestsCount: z.number().int().min(1, "Количество гостей не меньше 1"),
  totalAmount: z.number().int().nonnegative("Сумма не может быть отрицательной"),
  status: z.enum(["PENDING", "CONFIRMED"]).optional(),
  comment: optionalText.optional(),
}).strict();

export const updateBookingSchema = z.object({
  propertyId: z.string().trim().min(1, "Укажите объект").optional(),
  guestId: z.string().trim().min(1, "Укажите гостя").optional(),
  salesChannelId: z.string().trim().min(1, "Укажите канал продаж").optional(),
  channelListingId: optionalText.optional(),
  checkIn: dateOnly.optional(),
  checkOut: dateOnly.optional(),
  guestsCount: z.number().int().min(1, "Количество гостей не меньше 1").optional(),
  totalAmount: z.number().int().nonnegative("Сумма не может быть отрицательной").optional(),
  status: z.enum(BOOKING_STATUSES).optional(),
  comment: optionalText.optional(),
}).strict();

export type CreateGuestInput = z.infer<typeof createGuestSchema>;
export type UpdateGuestInput = z.infer<typeof updateGuestSchema>;
export type CreateGuestHistoryInput = z.infer<typeof createGuestHistorySchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
