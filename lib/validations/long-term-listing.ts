import { z } from "zod";
import {
  parsePublicationPhoneCountryCode,
  parsePublicationPhoneNumber,
} from "@/lib/publications/normalized-long-term";

export const LONG_TERM_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"] as const;

function finiteNumber(message: string) {
  return z
    .number({ error: message })
    .refine((value) => Number.isFinite(value), { message });
}

const nonNegativeInt = finiteNumber("Укажите целое число ≥ 0").int().nonnegative();
const nonNegativeNumber = finiteNumber("Укажите число ≥ 0").nonnegative();
const minimumRentalPeriod = finiteNumber("Минимальный срок не меньше 1 месяца")
  .int()
  .min(1, "Минимальный срок не меньше 1 месяца");
const sortOrder = finiteNumber("Укажите порядок фотографии").int().nonnegative();

const publicationContactName = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value == null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  })
  .refine((value) => value === null || value.length <= 200, {
    message: "Слишком длинное имя контакта",
  })
  .optional();

const publicationPhoneCountryCode = z
  .union([z.string(), z.null()])
  .superRefine((value, ctx) => {
    if (value == null || value.trim() === "") {
      return;
    }
    if (!parsePublicationPhoneCountryCode(value)) {
      ctx.addIssue({ code: "custom", message: "Укажите код страны цифрами, например 7" });
    }
  })
  .transform((value) => {
    if (value == null || value.trim() === "") {
      return null;
    }
    return parsePublicationPhoneCountryCode(value);
  })
  .optional();

const publicationPhoneNumber = z
  .union([z.string(), z.null()])
  .superRefine((value, ctx) => {
    if (value == null || value.trim() === "") {
      return;
    }
    if (!parsePublicationPhoneNumber(value)) {
      ctx.addIssue({ code: "custom", message: "Укажите номер телефона цифрами" });
    }
  })
  .transform((value) => {
    if (value == null || value.trim() === "") {
      return null;
    }
    return parsePublicationPhoneNumber(value);
  })
  .optional();

const createLongTermListingShape = {
  propertyId: z.string().trim().min(1, "Укажите объект"),
};

const updateLongTermListingShape = {
  status: z.enum(LONG_TERM_STATUSES).optional(),
  monthlyPrice: nonNegativeInt.optional(),
  specialOfferPrice: nonNegativeInt.nullable().optional(),
  specialOfferText: z.string().trim().max(2000).optional().nullable(),
  deposit: nonNegativeInt.optional(),
  commission: nonNegativeNumber.optional(),
  minimumRentalPeriod: minimumRentalPeriod.optional(),
    marketingTitle: z.string().trim().max(200).optional(),
    description: z.string().max(20000).optional(),
  rentalTerms: z.string().max(10000).optional(),
  infrastructureDescription: z.string().max(20000).optional(),
  securityDescription: z.string().max(20000).optional(),
  parkingDescription: z.string().max(20000).optional(),
  transportDescription: z.string().max(20000).optional(),
  advantagesDescription: z.string().max(20000).optional(),
  publicationContactName,
  publicationPhoneCountryCode,
  publicationPhoneNumber,
};

export const LONG_TERM_UPDATE_KEYS = Object.keys(updateLongTermListingShape) as Array<
  keyof typeof updateLongTermListingShape
>;

export const createLongTermListingSchema = z.object(createLongTermListingShape).strict();

export const updateLongTermListingSchema = z.object(updateLongTermListingShape).strict();

export const longTermPhotosSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            photoId: z.string().trim().min(1),
            sortOrder,
            included: z.boolean(),
          })
          .strict(),
      )
      .refine((items) => new Set(items.map((item) => item.photoId)).size === items.length, {
        message: "Фотография не может быть добавлена дважды",
      }),
  })
  .strict();

export const createPropertyPhotoSchema = z
  .object({
    url: z
      .string()
      .trim()
      .min(1, "Укажите ссылку на фото")
      .max(2048, "Слишком длинный URL")
      .refine((value) => {
        if (value.startsWith("/")) {
          return !value.includes("..") && !value.includes("\\");
        }
        try {
          const parsed = new URL(value);
          return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
          return false;
        }
      }, "Укажите корректный http(s) URL или безопасный относительный путь"),
    caption: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

export type CreateLongTermListingInput = z.infer<typeof createLongTermListingSchema>;
export type UpdateLongTermListingInput = z.infer<typeof updateLongTermListingSchema>;
export type LongTermListingUpdateInput = UpdateLongTermListingInput;
export type LongTermPhotosInput = z.infer<typeof longTermPhotosSchema>;
export type CreatePropertyPhotoInput = z.infer<typeof createPropertyPhotoSchema>;

type AssertNoPropertyIdInUpdate = "propertyId" extends keyof UpdateLongTermListingInput ? never : true;
const _assertImmutablePropertyId: AssertNoPropertyIdInUpdate = true;
void _assertImmutablePropertyId;

export function parseCreateLongTermListing(body: unknown) {
  return createLongTermListingSchema.safeParse(body);
}

export function parseUpdateLongTermListing(body: unknown) {
  return updateLongTermListingSchema.safeParse(body);
}

export function formatLongTermListingZodError(error: z.ZodError) {
  return error.issues.flatMap((issue) => {
    const keys = "keys" in issue && Array.isArray(issue.keys) ? issue.keys.map(String) : [];
    if (keys.length > 0) {
      return keys.map((key) =>
        key === "propertyId"
          ? "propertyId нельзя изменять после создания"
          : `Некорректные данные: неизвестное поле ${key}`,
      );
    }
    const path = issue.path.join(".") || "body";
    return [`${path}: ${issue.message}`];
  });
}

export function longTermListingUpdateFromFormData(form: FormData): UpdateLongTermListingInput {
  const specialOfferPriceRaw = String(form.get("specialOfferPrice") ?? "").trim();
  const candidate = {
    status: String(form.get("status")),
    monthlyPrice: Number(form.get("monthlyPrice")),
    specialOfferPrice: specialOfferPriceRaw ? Number(specialOfferPriceRaw) : null,
    specialOfferText: String(form.get("specialOfferText") ?? ""),
    deposit: Number(form.get("deposit")),
    commission: Number(form.get("commission")),
    minimumRentalPeriod: Number(form.get("minimumRentalPeriod")),
    marketingTitle: String(form.get("marketingTitle") ?? ""),
    description: String(form.get("description") ?? ""),
    rentalTerms: String(form.get("rentalTerms") ?? ""),
    infrastructureDescription: String(form.get("infrastructureDescription") ?? ""),
    securityDescription: String(form.get("securityDescription") ?? ""),
    parkingDescription: String(form.get("parkingDescription") ?? ""),
    transportDescription: String(form.get("transportDescription") ?? ""),
    advantagesDescription: String(form.get("advantagesDescription") ?? ""),
    publicationContactName: String(form.get("publicationContactName") ?? ""),
    publicationPhoneCountryCode: String(form.get("publicationPhoneCountryCode") ?? ""),
    publicationPhoneNumber: String(form.get("publicationPhoneNumber") ?? ""),
  };

  const parsed = updateLongTermListingSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(formatLongTermListingZodError(parsed.error).join(". "));
  }
  return parsed.data;
}
