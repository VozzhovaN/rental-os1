import { z } from "zod";

const moneyAmount = z
  .number({ error: "Укажите сумму" })
  .int("Сумма должна быть целым числом рублей")
  .positive("Сумма должна быть больше 0")
  .max(1_000_000_000_000);

const nonNegMoney = z
  .number({ error: "Укажите сумму" })
  .int()
  .nonnegative()
  .max(1_000_000_000_000);

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату ГГГГ-ММ-ДД")
  .transform((value) => new Date(`${value}T12:00:00.000Z`));

const notes = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .nullable()
  .transform((v) => (v == null || v === "" ? null : v));

export const createLongTermContractSchema = z
  .object({
    propertyId: z.string().trim().min(1),
    longTermListingId: z.string().trim().min(1).optional().nullable(),
    guestId: z.string().trim().min(1),
    startDate: isoDate,
    endDate: isoDate.optional().nullable(),
    monthlyRent: moneyAmount,
    depositAmount: nonNegMoney.default(0),
    paymentDay: z.number().int().min(1).max(28),
    notes,
    /** If omitted, DRAFT. Only DRAFT|ACTIVE allowed on create. */
    status: z.enum(["DRAFT", "ACTIVE"]).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({ code: "custom", message: "Дата окончания раньше начала", path: ["endDate"] });
    }
  });

export const updateLongTermContractSchema = z
  .object({
    guestId: z.string().trim().min(1).optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional().nullable(),
    monthlyRent: moneyAmount.optional(),
    depositAmount: nonNegMoney.optional(),
    paymentDay: z.number().int().min(1).max(28).optional(),
    notes,
  })
  .strict();

export const generateChargesSchema = z
  .object({
    /** Inclusive YYYY-MM */
    fromMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    /** Inclusive YYYY-MM */
    toMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    includeDeposit: z.boolean().optional(),
  })
  .strict();

export const recordLongTermPaymentSchema = z
  .object({
    amount: moneyAmount,
    paidAt: isoDate,
    method: z
      .string()
      .trim()
      .max(100)
      .optional()
      .nullable()
      .transform((v) => (v == null || v === "" ? null : v)),
    note: notes,
    /** Optional explicit allocations. If omitted, auto-allocate oldest OPEN charges. */
    allocations: z
      .array(
        z
          .object({
            chargeId: z.string().trim().min(1),
            amount: moneyAmount,
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

export const createManualChargeSchema = z
  .object({
    type: z.enum(["RENT", "DEPOSIT", "ADJUSTMENT"]),
    amount: moneyAmount,
    dueDate: isoDate,
    periodStart: isoDate.optional().nullable(),
    periodEnd: isoDate.optional().nullable(),
    description: notes,
  })
  .strict();

export type CreateLongTermContractInput = z.infer<typeof createLongTermContractSchema>;
export type UpdateLongTermContractInput = z.infer<typeof updateLongTermContractSchema>;
export type GenerateChargesInput = z.infer<typeof generateChargesSchema>;
export type RecordLongTermPaymentInput = z.infer<typeof recordLongTermPaymentSchema>;
export type CreateManualChargeInput = z.infer<typeof createManualChargeSchema>;
