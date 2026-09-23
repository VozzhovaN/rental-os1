import type { Buyer, BuyerInterestStatus, MessengerType } from "@prisma/client";
import { recordBuyerHistory } from "@/lib/buyer-history";
import { prisma } from "@/lib/prisma";
import { normalizePhoneDigits } from "@/lib/guests";
import type { CreateBuyerInput, UpdateBuyerInput } from "@/lib/validations/buyer";

export class BuyerError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "CONFLICT" | "VALIDATION",
  ) {
    super(message);
    this.name = "BuyerError";
  }
}

export type BuyerDTO = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  messengerType: MessengerType | null;
  messengerContact: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BuyerListItemDTO = BuyerDTO & {
  interestsCount: number;
  statusSummary: BuyerInterestStatus | null;
};

type BuyerWithCounts = Buyer & {
  _count: { interests: number };
  interests: Array<{ status: BuyerInterestStatus; updatedAt: Date }>;
};

export function serializeBuyer(buyer: Buyer): BuyerDTO {
  return {
    id: buyer.id,
    name: buyer.name,
    phone: buyer.phone,
    email: buyer.email,
    messengerType: buyer.messengerType,
    messengerContact: buyer.messengerContact,
    notes: buyer.notes,
    createdAt: buyer.createdAt.toISOString(),
    updatedAt: buyer.updatedAt.toISOString(),
  };
}

function summarizeStatuses(
  interests: Array<{ status: BuyerInterestStatus; updatedAt: Date }>,
): BuyerInterestStatus | null {
  if (interests.length === 0) {
    return null;
  }
  const latest = [...interests].sort(
    (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
  )[0];
  return latest.status;
}

export function serializeBuyerListItem(buyer: BuyerWithCounts): BuyerListItemDTO {
  return {
    ...serializeBuyer(buyer),
    interestsCount: buyer._count.interests,
    statusSummary: summarizeStatuses(buyer.interests),
  };
}

function buyerSearchWhere(q?: string) {
  const needle = q?.trim();
  if (!needle) {
    return undefined;
  }
  return {
    OR: [
      { name: { contains: needle } },
      { phone: { contains: needle } },
      { email: { contains: needle } },
    ],
  };
}

export async function getBuyers(filters: { q?: string } = {}) {
  return prisma.buyer.findMany({
    where: buyerSearchWhere(filters.q),
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { interests: true } },
      interests: { select: { status: true, updatedAt: true } },
    },
  });
}

export async function getBuyerById(id: string) {
  return prisma.buyer.findUnique({
    where: { id },
    include: {
      _count: { select: { interests: true } },
      interests: {
        include: {
          saleListing: { include: { property: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
}

function normalizeBuyerData(input: CreateBuyerInput | UpdateBuyerInput) {
  const data: {
    name?: string;
    phone?: string | null;
    email?: string | null;
    messengerType?: MessengerType | null;
    messengerContact?: string | null;
    notes?: string | null;
  } = {};

  if ("name" in input && input.name !== undefined) {
    data.name = input.name;
  }
  if (input.phone !== undefined) {
    data.phone = input.phone;
  }
  if (input.email !== undefined) {
    data.email = input.email ? input.email.trim().toLowerCase() : null;
  }
  if (input.messengerType !== undefined) {
    data.messengerType = input.messengerType;
  }
  if (input.messengerContact !== undefined) {
    data.messengerContact = input.messengerContact;
  }
  if (input.notes !== undefined) {
    data.notes = input.notes;
  }

  return data;
}

export async function createBuyer(input: CreateBuyerInput) {
  return prisma.$transaction(async (tx) => {
    const buyer = await tx.buyer.create({
      data: {
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ? input.email.trim().toLowerCase() : null,
        messengerType: input.messengerType ?? null,
        messengerContact: input.messengerContact ?? null,
        notes: input.notes ?? null,
      },
    });
    await recordBuyerHistory(
      {
        buyerId: buyer.id,
        type: "BUYER_CREATED",
        message: `Клиент «${buyer.name}» создан`,
      },
      tx,
    );
    return buyer;
  });
}

export async function updateBuyer(id: string, input: UpdateBuyerInput) {
  const current = await prisma.buyer.findUnique({ where: { id } });
  if (!current) {
    throw new BuyerError("Клиент не найден", "NOT_FOUND");
  }

  return prisma.$transaction(async (tx) => {
    const buyer = await tx.buyer.update({
      where: { id },
      data: normalizeBuyerData(input),
    });
    await recordBuyerHistory(
      {
        buyerId: buyer.id,
        type: "BUYER_UPDATED",
        message: "Данные клиента обновлены",
      },
      tx,
    );
    return buyer;
  });
}

export { normalizePhoneDigits };
