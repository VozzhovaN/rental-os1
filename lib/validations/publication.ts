import { z } from "zod";
import { formatZodError } from "@/lib/validations/property";

export const createPublicationSchema = z
  .object({
    salesChannelId: z.string().trim().min(1, "Укажите канал продаж"),
  })
  .strict();

export type CreatePublicationInput = z.infer<typeof createPublicationSchema>;

export function parseCreatePublication(body: unknown) {
  return createPublicationSchema.safeParse(body);
}

export function formatPublicationZodError(error: z.ZodError) {
  return formatZodError(error);
}
