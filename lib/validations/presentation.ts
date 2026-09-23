import { z } from "zod";
import {
  PRESENTATION_KINDS,
  PRESENTATION_SECTION_TYPES,
  PRESENTATION_STATUSES,
} from "@/lib/presentations";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const createPresentationSchema = z
  .object({
    kind: z.enum(PRESENTATION_KINDS),
    propertyIds: z.array(z.string().trim().min(1)).min(1).max(5),
    title: z.string().trim().min(1).max(200).optional(),
    subtitle: optionalText,
    companyName: optionalText,
    contactName: optionalText,
    contactPhone: optionalText,
    contactEmail: optionalText,
  })
  .strict();

const sectionSchema = z.object({
  id: z.string().optional(),
  type: z.enum(PRESENTATION_SECTION_TYPES),
  title: z.string().trim().min(1).max(200),
  content: z.string().max(20_000),
  sortOrder: z.number().int().min(0),
  isVisible: z.boolean(),
});

const itemUpdateSchema = z.object({
  id: z.string().min(1),
  titleOverride: optionalText,
  priceOverride: z.number().int().min(0).nullable().optional(),
  descriptionOverride: optionalText,
  coverPhotoId: optionalText,
  videoUrl: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional()
    .refine(
      (v) =>
        v == null ||
        v === "" ||
        /^https:\/\//i.test(v),
      "Видео: только https URL",
    ),
  sortOrder: z.number().int().min(0).optional(),
  photoIds: z.array(z.string().min(1)).max(10).optional(),
  sections: z.array(sectionSchema).max(20).optional(),
});

export const updatePresentationSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    subtitle: optionalText,
    companyName: optionalText,
    contactName: optionalText,
    contactPhone: optionalText,
    contactEmail: optionalText,
    internalNote: optionalText,
    status: z.enum(PRESENTATION_STATUSES).optional(),
    items: z.array(itemUpdateSchema).optional(),
  })
  .strict();

export type CreatePresentationBody = z.infer<typeof createPresentationSchema>;
export type UpdatePresentationBody = z.infer<typeof updatePresentationSchema>;

export function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => issue.message);
}
