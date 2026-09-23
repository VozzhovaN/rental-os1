import { z } from "zod";
import { emptyToNull } from "@/lib/format";

const optionalText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => emptyToNull(value ?? undefined));

export const createViewingSchema = z
  .object({
    scheduledAt: z
      .string()
      .trim()
      .min(1, "Укажите дату и время показа")
      .refine((value) => !Number.isNaN(Date.parse(value)), "Некорректная дата показа"),
    notes: optionalText,
  })
  .strict();

export const createDepositSchema = z
  .object({
    amount: z
      .number({ error: "Укажите сумму задатка" })
      .int("Сумма должна быть целым числом")
      .positive("Сумма задатка должна быть больше 0"),
    notes: optionalText,
  })
  .strict();

export type CreateViewingInput = z.input<typeof createViewingSchema>;
export type CreateDepositInput = z.input<typeof createDepositSchema>;

export function formatViewingDepositZodError(error: z.ZodError) {
  return error.issues.flatMap((issue) => {
    const keys = "keys" in issue && Array.isArray(issue.keys) ? issue.keys.map(String) : [];
    if (keys.length > 0) {
      return keys.map((key) => {
        if (key === "buyerInterestId") {
          return "buyerInterestId нельзя изменять";
        }
        return `Некорректные данные: неизвестное поле ${key}`;
      });
    }
    const path = issue.path.join(".") || "body";
    return [`${path}: ${issue.message}`];
  });
}
