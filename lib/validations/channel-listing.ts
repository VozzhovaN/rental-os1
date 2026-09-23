import { z } from "zod";
import { LISTING_STATUSES } from "@/lib/sales-channel-codes";

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))
  .refine(
    (value) => value === null || /^https?:\/\/.+/i.test(value),
    "Укажите корректный URL",
  );

export const createChannelListingSchema = z.object({
  salesChannelId: z.string().trim().min(1, "Укажите канал продаж"),
  externalId: z.string().trim().min(1, "Укажите ID объявления"),
  externalUrl: optionalUrl,
});

export const updateChannelListingSchema = z.object({
  externalId: z.string().trim().min(1, "Укажите ID объявления").optional(),
  externalUrl: optionalUrl,
  status: z.enum(LISTING_STATUSES).optional(),
});

export type CreateChannelListingInput = z.infer<typeof createChannelListingSchema>;
export type UpdateChannelListingInput = z.infer<typeof updateChannelListingSchema>;
