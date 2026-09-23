import { z } from "zod";

const moneyAmount = z
  .number({ error: "Укажите сумму" })
  .int("Сумма должна быть целым числом рублей")
  .positive("Сумма должна быть больше 0")
  .max(1_000_000_000_000, "Сумма слишком большая");

const paidAt = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату в формате ГГГГ-ММ-ДД")
  .transform((value) => new Date(`${value}T12:00:00.000Z`));

export const createCommissionPaymentSchema = z
  .object({
    propertyId: z.string().trim().min(1, "Укажите объект"),
    amount: moneyAmount,
    paidAt,
    method: z.string().trim().max(200).optional().nullable(),
    note: z.string().trim().max(2000).optional().nullable(),
    bookingId: z.string().trim().min(1).optional().nullable(),
    longTermContractId: z.string().trim().min(1).optional().nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasBooking = Boolean(data.bookingId);
    const hasContract = Boolean(data.longTermContractId);
    if (hasBooking === hasContract) {
      ctx.addIssue({
        code: "custom",
        message: "Укажите ровно одно: bookingId или longTermContractId",
        path: ["bookingId"],
      });
    }
  });

export type CreateCommissionPaymentInput = z.infer<typeof createCommissionPaymentSchema>;

export const listCommissionPaymentsQuerySchema = z
  .object({
    propertyId: z.string().trim().min(1).optional(),
    bookingId: z.string().trim().min(1).optional(),
    longTermContractId: z.string().trim().min(1).optional(),
    dateFrom: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    dateTo: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .strict();

export type ListCommissionPaymentsQuery = z.infer<typeof listCommissionPaymentsQuerySchema>;
