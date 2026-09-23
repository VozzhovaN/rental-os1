import { z } from "zod";

const moneyAmount = z
  .number({ error: "Укажите сумму" })
  .int()
  .positive()
  .max(1_000_000_000_000);

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((v) => new Date(`${v}T12:00:00.000Z`));

const optionalNote = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((v) => (v == null || v === "" ? null : v));

export const createOwnerSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    phone: z.string().trim().max(40).optional().nullable(),
    email: z
      .string()
      .trim()
      .email("Некорректный email")
      .max(200)
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
    notes: optionalNote.optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const updateOwnerSchema = createOwnerSchema.partial().strict();

export const createOwnerPayoutSchema = z
  .object({
    amount: moneyAmount,
    paidAt: isoDate,
    method: z.string().trim().max(100).optional().nullable(),
    note: optionalNote,
    allocations: z
      .array(
        z
          .object({
            propertyId: z.string().trim().min(1),
            amount: moneyAmount,
          })
          .strict(),
      )
      .min(1, "Укажите распределение по объектам"),
  })
  .strict();

export const createOwnerSettlementSchema = z
  .object({
    periodStart: isoDate,
    periodEnd: isoDate,
    notes: optionalNote,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.periodEnd < data.periodStart) {
      ctx.addIssue({ code: "custom", message: "periodEnd раньше periodStart", path: ["periodEnd"] });
    }
  });

export const ownerFinanceQuerySchema = z
  .object({
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .strict();

export type CreateOwnerInput = z.infer<typeof createOwnerSchema>;
export type UpdateOwnerInput = z.infer<typeof updateOwnerSchema>;
export type CreateOwnerPayoutInput = z.infer<typeof createOwnerPayoutSchema>;
export type CreateOwnerSettlementInput = z.infer<typeof createOwnerSettlementSchema>;
export type OwnerFinanceQuery = z.infer<typeof ownerFinanceQuerySchema>;
