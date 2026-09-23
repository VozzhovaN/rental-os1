import { z } from "zod";

const moneyAmount = z
  .number({ error: "Укажите сумму" })
  .int("Сумма должна быть целым числом рублей")
  .positive("Сумма должна быть больше 0")
  .max(1_000_000_000_000, "Сумма слишком большая");

const optionalNote = z
  .string()
  .trim()
  .max(2000, "Слишком длинный комментарий")
  .optional()
  .nullable()
  .transform((value) => {
    if (value == null || value === "") return null;
    return value;
  });

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату в формате ГГГГ-ММ-ДД")
  .transform((value) => new Date(`${value}T12:00:00.000Z`));

export const recordBookingPaymentSchema = z
  .object({
    amount: moneyAmount,
    paidAt: isoDate,
    method: z
      .string()
      .trim()
      .max(100)
      .optional()
      .nullable()
      .transform((value) => {
        if (value == null || value === "") return null;
        return value;
      }),
    note: optionalNote,
  })
  .strict();

export const recordBookingRefundSchema = z
  .object({
    amount: moneyAmount,
    refundedAt: isoDate,
    note: z
      .string()
      .trim()
      .min(1, "Укажите причину возврата")
      .max(2000, "Слишком длинный комментарий"),
  })
  .strict();

export type RecordBookingPaymentInput = z.infer<typeof recordBookingPaymentSchema>;
export type RecordBookingRefundInput = z.infer<typeof recordBookingRefundSchema>;
