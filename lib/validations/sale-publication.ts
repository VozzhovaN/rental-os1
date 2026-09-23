import { z } from "zod";
import { formatZodError } from "@/lib/validations/property";

export const createSalePublicationSchema = z
  .object({
    salesChannelId: z.string().trim().min(1, "Укажите канал продаж"),
  })
  .strict();

export type CreateSalePublicationInput = z.infer<typeof createSalePublicationSchema>;

export function parseCreateSalePublication(body: unknown) {
  return createSalePublicationSchema.safeParse(body);
}

export function formatSalePublicationZodError(error: z.ZodError) {
  return formatZodError(error);
}
