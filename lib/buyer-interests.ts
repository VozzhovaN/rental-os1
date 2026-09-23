import {
  Prisma,
  type Buyer,
  type BuyerInterest,
  type BuyerInterestStatus,
  type Property,
  type SaleListing,
} from "@prisma/client";
import {
  assertBuyerInterestTransition,
  getManualTargetsFrom,
  isManualBuyerInterestTarget,
} from "@/lib/buyer-interest-fsm";
import { recordBuyerHistory } from "@/lib/buyer-history";
import { prisma } from "@/lib/prisma";
import { serializeBuyer, type BuyerDTO } from "@/lib/buyers";
import { serializeSaleListing, type SaleListingDTO } from "@/lib/sale-listings";
import type {
  CreateBuyerInterestInput,
  UpdateBuyerInterestInput,
} from "@/lib/validations/buyer";
import { buyerInterestStatusLabels } from "@/lib/buyer-interest-labels";

export class BuyerInterestError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "CONFLICT" | "VALIDATION",
    readonly machineCode?: "SALE_LISTING_ALREADY_SOLD",
  ) {
    super(message);
    this.name = "BuyerInterestError";
  }
}

const interestInclude = {
  buyer: true,
  saleListing: {
    include: {
      property: true,
      photos: {
        include: { propertyPhoto: true },
        orderBy: { order: "asc" as const },
      },
    },
  },
} as const;

type InterestRecord = BuyerInterest & {
  buyer: Buyer;
  saleListing: SaleListing & {
    property: Property;
    photos: Array<{
      id: string;
      saleListingId: string;
      propertyPhotoId: string;
      order: number;
      propertyPhoto: {
        id: string;
        propertyId: string;
        url: string;
        caption: string | null;
        sortOrder: number;
        createdAt: Date;
      };
    }>;
  };
};

export type BuyerInterestDTO = {
  id: string;
  buyerId: string;
  saleListingId: string;
  status: BuyerInterestStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  buyer: BuyerDTO;
  saleListing: SaleListingDTO;
  manualTargets: BuyerInterestStatus[];
};

export function serializeBuyerInterest(interest: InterestRecord): BuyerInterestDTO {
  return {
    id: interest.id,
    buyerId: interest.buyerId,
    saleListingId: interest.saleListingId,
    status: interest.status,
    notes: interest.notes,
    createdAt: interest.createdAt.toISOString(),
    updatedAt: interest.updatedAt.toISOString(),
    buyer: serializeBuyer(interest.buyer),
    saleListing: serializeSaleListing(interest.saleListing),
    manualTargets: getManualTargetsFrom(interest.status),
  };
}

export async function getBuyerInterests(filters: {
  buyerId?: string;
  saleListingId?: string;
  status?: BuyerInterestStatus;
} = {}) {
  return prisma.buyerInterest.findMany({
    where: {
      buyerId: filters.buyerId,
      saleListingId: filters.saleListingId,
      status: filters.status,
    },
    include: interestInclude,
    orderBy: { updatedAt: "desc" },
  });
}

export async function getBuyerInterestById(id: string) {
  return prisma.buyerInterest.findUnique({
    where: { id },
    include: interestInclude,
  });
}

export async function createBuyerInterest(input: CreateBuyerInterestInput) {
  const buyer = await prisma.buyer.findUnique({ where: { id: input.buyerId } });
  if (!buyer) {
    throw new BuyerInterestError("Клиент не найден", "NOT_FOUND");
  }

  const listing = await prisma.saleListing.findUnique({
    where: { id: input.saleListingId },
  });
  if (!listing) {
    throw new BuyerInterestError("Карточка продажи не найдена", "NOT_FOUND");
  }
  if (listing.status === "SOLD") {
    throw new BuyerInterestError(
      "Объект уже продан",
      "CONFLICT",
      "SALE_LISTING_ALREADY_SOLD",
    );
  }
  if (listing.status === "ARCHIVED") {
    throw new BuyerInterestError(
      "Нельзя добавить интерес к архивной карточке",
      "VALIDATION",
    );
  }

  const existing = await prisma.buyerInterest.findUnique({
    where: {
      buyerId_saleListingId: {
        buyerId: input.buyerId,
        saleListingId: input.saleListingId,
      },
    },
    include: interestInclude,
  });
  if (existing) {
    return { interest: existing, created: false as const };
  }

  try {
    const interest = await prisma.$transaction(async (tx) => {
      const created = await tx.buyerInterest.create({
        data: {
          buyerId: input.buyerId,
          saleListingId: input.saleListingId,
          status: "INTERESTED",
          notes: input.notes ?? null,
        },
        include: interestInclude,
      });
      const title =
        created.saleListing.marketingTitle || created.saleListing.property.name;
      await recordBuyerHistory(
        {
          buyerId: input.buyerId,
          buyerInterestId: created.id,
          type: "INTEREST_ADDED",
          message: `Добавлен интерес к объекту «${title}»`,
        },
        tx,
      );
      return created;
    });
    return { interest, created: true as const };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const interest = await prisma.buyerInterest.findUnique({
        where: {
          buyerId_saleListingId: {
            buyerId: input.buyerId,
            saleListingId: input.saleListingId,
          },
        },
        include: interestInclude,
      });
      if (interest) {
        return { interest, created: false as const };
      }
      throw new BuyerInterestError("Интерес уже существует", "CONFLICT");
    }
    throw error;
  }
}

export async function transitionBuyerInterest(
  id: string,
  nextStatus: BuyerInterestStatus,
  options: { allowWorkflowStatuses?: boolean } = {},
) {
  const current = await getBuyerInterestById(id);
  if (!current) {
    throw new BuyerInterestError("Интерес не найден", "NOT_FOUND");
  }

  if (!options.allowWorkflowStatuses && !isManualBuyerInterestTarget(nextStatus)) {
    throw new BuyerInterestError(
      "Этот статус задаётся только workflow просмотра/задатка/покупки",
      "VALIDATION",
    );
  }

  try {
    assertBuyerInterestTransition(current.status, nextStatus);
  } catch {
    throw new BuyerInterestError(
      `Переход ${current.status} → ${nextStatus} недопустим`,
      "VALIDATION",
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.buyerInterest.update({
      where: { id },
      data: { status: nextStatus },
      include: interestInclude,
    });

    const historyType = nextStatus === "REFUSED" ? "REFUSED" : "INTEREST_STATUS_CHANGED";
    await recordBuyerHistory(
      {
        buyerId: current.buyerId,
        buyerInterestId: id,
        type: historyType,
        message:
          nextStatus === "REFUSED"
            ? "Отказ по интересу"
            : `Статус интереса: ${buyerInterestStatusLabels[nextStatus]}`,
      },
      tx,
    );

    return updated;
  });
}

export async function updateBuyerInterest(id: string, input: UpdateBuyerInterestInput) {
  const current = await getBuyerInterestById(id);
  if (!current) {
    throw new BuyerInterestError("Интерес не найден", "NOT_FOUND");
  }

  if (input.status !== undefined) {
    const transitioned = await transitionBuyerInterest(id, input.status);
    if (input.notes === undefined) {
      return transitioned;
    }
    return prisma.buyerInterest.update({
      where: { id },
      data: { notes: input.notes },
      include: interestInclude,
    });
  }

  if (input.notes === undefined) {
    return current;
  }

  return prisma.buyerInterest.update({
    where: { id },
    data: { notes: input.notes },
    include: interestInclude,
  });
}
