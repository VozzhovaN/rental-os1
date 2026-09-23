import { z } from "zod";
import {
  ADJUSTMENT_DIRECTIONS,
  EXPENSE_CATEGORIES,
  FINANCIAL_CATEGORIES,
  FINANCIAL_TRANSACTION_TYPES,
} from "@/lib/finance/types";

const moneyAmount = z
  .number({ error: "Укажите сумму" })
  .int("Сумма должна быть целым числом рублей")
  .positive("Сумма должна быть больше 0")
  .max(1_000_000_000_000, "Сумма слишком большая");

const occurredAt = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату в формате ГГГГ-ММ-ДД")
  .transform((value) => new Date(`${value}T12:00:00.000Z`));

const description = z
  .string()
  .trim()
  .max(2000, "Слишком длинное описание")
  .optional()
  .nullable()
  .transform((value) => {
    if (value == null || value === "") return null;
    return value;
  });

export const createExpenseSchema = z
  .object({
    propertyId: z
      .string()
      .trim()
      .min(1, "Укажите объект")
      .optional()
      .nullable()
      .transform((value) => {
        if (value == null || value === "") return null;
        return value;
      }),
    amount: moneyAmount,
    category: z.enum(EXPENSE_CATEGORIES, { message: "Укажите категорию расхода" }),
    occurredAt,
    description,
    /** OPERATOR (default) or OWNER. Legacy/null = OPERATOR. */
    expenseResponsibility: z.enum(["OPERATOR", "OWNER"]).optional().default("OPERATOR"),
  })
  .strict();

export const createAdjustmentSchema = z
  .object({
    propertyId: z.string().trim().min(1, "Укажите объект"),
    amount: moneyAmount,
    direction: z.enum(ADJUSTMENT_DIRECTIONS, { message: "Укажите направление корректировки" }),
    occurredAt,
    description: z
      .string()
      .trim()
      .min(1, "Укажите причину корректировки")
      .max(2000, "Слишком длинное описание"),
    /** When set, adjustment affects owner balanceDue. */
    ownerId: z.string().trim().min(1).optional().nullable(),
  })
  .strict();

export const listFinanceQuerySchema = z
  .object({
    propertyId: z.string().trim().min(1).optional(),
    type: z.enum(FINANCIAL_TRANSACTION_TYPES).optional(),
    category: z.enum(FINANCIAL_CATEGORIES).optional(),
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

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;
export type ListFinanceQuery = z.infer<typeof listFinanceQuerySchema>;

/** Direct service input: responsibility optional (defaults to OPERATOR). */
export type CreateExpenseServiceInput = Omit<CreateExpenseInput, "expenseResponsibility"> & {
  expenseResponsibility?: "OPERATOR" | "OWNER";
};
