import { z } from "zod";

export const PROPERTY_TYPES = ["APARTMENT", "HOUSE", "STUDIO", "OTHER"] as const;
export const PROPERTY_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export const MANAGEMENT_TYPES = ["OWN", "COMMISSION"] as const;
export const RENT_COLLECTION_MODES = ["OPERATOR", "OWNER_DIRECT"] as const;

const optionalInt = z.number().int().nonnegative().nullable().optional();
const optionalFloat = z.number().nonnegative().nullable().optional();

const propertyFields = {
  name: z.string().trim().min(1, "Укажите название").max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Slug может содержать только латиницу, цифры и дефис")
    .optional(),
  type: z.enum(PROPERTY_TYPES, { message: "Укажите тип объекта" }),
  status: z.enum(PROPERTY_STATUSES, { message: "Укажите статус" }),
  address: z.string().trim().min(1, "Укажите адрес").max(500),
  city: z.string().trim().min(1, "Укажите город").max(120),
  district: z.string().trim().min(1, "Укажите район").max(120),
  area: z.number().positive("Площадь должна быть больше 0"),
  rooms: z.number().int().nonnegative("Количество комнат не может быть отрицательным"),
  bedrooms: z.number().int().nonnegative("Количество спален не может быть отрицательным"),
  bathrooms: z.number().int().nonnegative("Количество санузлов не может быть отрицательным"),
  floor: optionalInt,
  totalFloors: optionalInt,
  guests: z.number().int().positive("Укажите вместимость"),
  description: z.string().trim().min(1, "Укажите описание").max(20000),
  shortDescription: z.string().trim().min(1, "Укажите краткое описание").max(2000),
  ownerName: z.string().trim().min(1, "Укажите имя владельца").max(200),
  ownerPhone: z.string().trim().min(1, "Укажите телефон владельца").max(40),
  /** Structured Owner for COMMISSION. Optional; null clears link. */
  ownerId: z.string().trim().min(1).nullable().optional(),
  managementType: z.enum(MANAGEMENT_TYPES, { message: "Укажите тип управления" }),
  rentCollectionMode: z
    .enum(RENT_COLLECTION_MODES, { message: "Укажите режим сбора аренды" })
    .optional(),
  dailyPrice: optionalInt,
  monthlyPrice: optionalInt,
  commissionDaily: optionalFloat,
  commissionMonthly: optionalFloat,
};

function refineRentCollectionMode<
  T extends { managementType?: (typeof MANAGEMENT_TYPES)[number]; rentCollectionMode?: (typeof RENT_COLLECTION_MODES)[number] },
>(schema: z.ZodType<T>) {
  return schema.superRefine((data, ctx) => {
    if (data.managementType === "OWN" && data.rentCollectionMode === "OWNER_DIRECT") {
      ctx.addIssue({
        code: "custom",
        message: "Собственный объект не может использовать прямой сбор аренды собственником",
        path: ["rentCollectionMode"],
      });
    }
  });
}

export const createPropertySchema = refineRentCollectionMode(
  z.object(propertyFields).strict(),
);

export const updatePropertySchema = refineRentCollectionMode(
  z.object(propertyFields).partial().strict(),
);

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;

export function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => issue.message);
}
