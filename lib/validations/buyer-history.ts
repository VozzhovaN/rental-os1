import { z } from "zod";
import { emptyToNull } from "@/lib/format";

export const createBuyerHistoryNoteSchema = z
  .object({
    message: z
      .string()
      .trim()
      .min(1, "Укажите текст заметки")
      .max(2000, "Слишком длинная заметка")
      .transform((value) => emptyToNull(value) ?? value),
  })
  .strict();

export type CreateBuyerHistoryNoteInput = z.input<typeof createBuyerHistoryNoteSchema>;
