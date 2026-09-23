import { z } from "zod";
import { emptyToNull } from "@/lib/format";
import { BUYER_INTEREST_MANUAL_TARGETS } from "@/lib/buyer-interest-fsm";

export const MESSENGER_TYPES = ["MAX", "TELEGRAM"] as const;

export const BUYER_INTEREST_STATUSES = [
  "INTERESTED",
  "VIEWING_REQUESTED",
  "VIEWING_SCHEDULED",
  "VIEWING_COMPLETED",
  "THINKING",
  "DEPOSIT_PAID",
  "PURCHASED",
  "REFUSED",
] as const;

const optionalText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => emptyToNull(value ?? undefined));

const buyerShape = {
  name: z.string().trim().min(1, "Укажите имя").max(200),
  phone: optionalText.refine(
    (value) => value === null || /^\+?[0-9\s()-]{10,20}$/.test(value),
    "Некорректный телефон",
  ),
  email: optionalText.refine(
    (value) => value === null || z.string().email().safeParse(value).success,
    "Некорректный email",
  ),
  messengerType: z.enum(MESSENGER_TYPES).nullable().optional(),
  messengerContact: optionalText,
  notes: optionalText,
};

export const createBuyerSchema = z.object(buyerShape).strict();

export const updateBuyerSchema = z
  .object({
    name: buyerShape.name.optional(),
    phone: buyerShape.phone,
    email: buyerShape.email,
    messengerType: buyerShape.messengerType,
    messengerContact: buyerShape.messengerContact,
    notes: buyerShape.notes,
  })
  .strict();

export const createBuyerInterestSchema = z
  .object({
    buyerId: z.string().trim().min(1, "Укажите клиента"),
    saleListingId: z.string().trim().min(1, "Укажите объект продажи"),
    notes: optionalText,
  })
  .strict();

export const updateBuyerInterestSchema = z
  .object({
    notes: optionalText,
    /** Only safe Stage 9.2 status targets; applied via FSM, not mass assignment. */
    status: z.enum(BUYER_INTEREST_MANUAL_TARGETS).optional(),
  })
  .strict();

export type CreateBuyerInput = z.input<typeof createBuyerSchema>;
export type UpdateBuyerInput = z.input<typeof updateBuyerSchema>;
export type CreateBuyerInterestInput = z.input<typeof createBuyerInterestSchema>;
export type UpdateBuyerInterestInput = z.input<typeof updateBuyerInterestSchema>;

type AssertNoBuyerIdInInterestUpdate = "buyerId" extends keyof UpdateBuyerInterestInput
  ? never
  : true;
type AssertNoListingIdInInterestUpdate = "saleListingId" extends keyof UpdateBuyerInterestInput
  ? never
  : true;
const _assertImmutableBuyerId: AssertNoBuyerIdInInterestUpdate = true;
const _assertImmutableListingId: AssertNoListingIdInInterestUpdate = true;
void _assertImmutableBuyerId;
void _assertImmutableListingId;

export function formatBuyerZodError(error: z.ZodError) {
  return error.issues.flatMap((issue) => {
    const keys = "keys" in issue && Array.isArray(issue.keys) ? issue.keys.map(String) : [];
    if (keys.length > 0) {
      return keys.map((key) => {
        if (key === "buyerId" || key === "saleListingId") {
          return `${key} нельзя изменять после создания`;
        }
        return `Некорректные данные: неизвестное поле ${key}`;
      });
    }
    const path = issue.path.join(".") || "body";
    return [`${path}: ${issue.message}`];
  });
}
