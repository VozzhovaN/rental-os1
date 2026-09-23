import {
  parsePublicationPhoneCountryCode,
  parsePublicationPhoneNumber,
} from "@/lib/publications/normalized-long-term";
import { z } from "zod";

export const SALE_LISTING_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "SOLD", "ARCHIVED"] as const;

/** Writable via PATCH. SOLD is reserved for purchase workflow. */
export const SALE_LISTING_WRITABLE_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"] as const;

function finiteNumber(message: string) {
  return z
    .number({ error: message })
    .refine((value) => Number.isFinite(value), { message });
}

const nonNegativeInt = finiteNumber("Укажите целое число ≥ 0").int().nonnegative();
const photoOrder = finiteNumber("Укажите порядок фотографии").int().nonnegative();

const optionalTrimmedText = (max?: number) =>
  z
    .union([z.string(), z.null()])
    .transform((value) => {
      if (value == null) {
        return null;
      }
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    })
    .refine((value) => value === null || max === undefined || value.length <= max, {
      message: max ? `Слишком длинный текст (макс. ${max})` : "Слишком длинный текст",
    })
    .optional();

const createSaleListingShape = {
  propertyId: z.string().trim().min(1, "Укажите объект"),
};

const updateSaleListingShape = {
  status: z.enum(SALE_LISTING_WRITABLE_STATUSES).optional(),
  price: nonNegativeInt.optional(),
  marketingTitle: optionalTrimmedText(200),
  description: optionalTrimmedText(20000),
  specialOfferPrice: nonNegativeInt.nullable().optional(),
  specialOfferText: optionalTrimmedText(2000),
  advantages: optionalTrimmedText(20000),
  infrastructure: optionalTrimmedText(20000),
  security: optionalTrimmedText(20000),
  parking: optionalTrimmedText(20000),
  transport: optionalTrimmedText(20000),
  publicationContactName: optionalTrimmedText(200),
  publicationPhoneCountryCode: optionalTrimmedText(8),
  publicationPhoneNumber: optionalTrimmedText(20),
  crmOwnerName: optionalTrimmedText(200),
  crmOwnerPhone: optionalTrimmedText(40),
  crmComment: optionalTrimmedText(20000),
};

export const SALE_LISTING_UPDATE_KEYS = Object.keys(updateSaleListingShape) as Array<
  keyof typeof updateSaleListingShape
>;

export const createSaleListingSchema = z.object(createSaleListingShape).strict();

export const updateSaleListingSchema = z.object(updateSaleListingShape).strict();

export const saleListingPhotosSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            photoId: z.string().trim().min(1),
            order: photoOrder,
          })
          .strict(),
      )
      .refine((items) => new Set(items.map((item) => item.photoId)).size === items.length, {
        message: "Фотография не может быть добавлена дважды",
      }),
  })
  .strict();

export type CreateSaleListingInput = z.infer<typeof createSaleListingSchema>;
export type UpdateSaleListingInput = z.infer<typeof updateSaleListingSchema>;
export type SaleListingPhotosInput = z.infer<typeof saleListingPhotosSchema>;

type AssertNoPropertyIdInUpdate = "propertyId" extends keyof UpdateSaleListingInput ? never : true;
const _assertImmutablePropertyId: AssertNoPropertyIdInUpdate = true;
void _assertImmutablePropertyId;

export function parseCreateSaleListing(body: unknown) {
  return createSaleListingSchema.safeParse(body);
}

export function parseUpdateSaleListing(body: unknown) {
  const parsed = updateSaleListingSchema.safeParse(body);
  if (!parsed.success) {
    return parsed;
  }

  const data = { ...parsed.data };

  if (data.publicationPhoneCountryCode !== undefined && data.publicationPhoneCountryCode !== null) {
    const normalized = parsePublicationPhoneCountryCode(data.publicationPhoneCountryCode);
    if (!normalized) {
      return {
        success: false as const,
        error: new z.ZodError([
          {
            code: "custom",
            path: ["publicationPhoneCountryCode"],
            message: "Некорректный код страны",
          },
        ]),
      };
    }
    data.publicationPhoneCountryCode = normalized;
  }

  if (data.publicationPhoneNumber !== undefined && data.publicationPhoneNumber !== null) {
    const normalized = parsePublicationPhoneNumber(data.publicationPhoneNumber);
    if (!normalized) {
      return {
        success: false as const,
        error: new z.ZodError([
          {
            code: "custom",
            path: ["publicationPhoneNumber"],
            message: "Некорректный телефон",
          },
        ]),
      };
    }
    data.publicationPhoneNumber = normalized;
  }

  return { success: true as const, data };
}

export function formatSaleListingZodError(error: z.ZodError) {
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

export function saleListingUpdateFromFormData(form: FormData): UpdateSaleListingInput {
  const specialOfferPriceRaw = String(form.get("specialOfferPrice") ?? "").trim();
  const statusRaw = form.get("status");
  const candidate: Record<string, unknown> = {
    price: Number(form.get("price")),
    marketingTitle: String(form.get("marketingTitle") ?? ""),
    description: String(form.get("description") ?? ""),
    specialOfferPrice: specialOfferPriceRaw ? Number(specialOfferPriceRaw) : null,
    specialOfferText: String(form.get("specialOfferText") ?? ""),
    advantages: String(form.get("advantages") ?? ""),
    infrastructure: String(form.get("infrastructure") ?? ""),
    security: String(form.get("security") ?? ""),
    parking: String(form.get("parking") ?? ""),
    transport: String(form.get("transport") ?? ""),
    publicationContactName: String(form.get("publicationContactName") ?? ""),
    publicationPhoneCountryCode: String(form.get("publicationPhoneCountryCode") ?? ""),
    publicationPhoneNumber: String(form.get("publicationPhoneNumber") ?? ""),
    crmOwnerName: String(form.get("crmOwnerName") ?? ""),
    crmOwnerPhone: String(form.get("crmOwnerPhone") ?? ""),
    crmComment: String(form.get("crmComment") ?? ""),
  };

  if (statusRaw != null && String(statusRaw).trim() !== "") {
    candidate.status = String(statusRaw);
  }

  const parsed = parseUpdateSaleListing(candidate);
  if (!parsed.success) {
    throw new Error(formatSaleListingZodError(parsed.error).join(". "));
  }
  return parsed.data;
}
