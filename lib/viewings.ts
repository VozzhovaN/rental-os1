import {
  type Buyer,
  type BuyerInterest,
  type Property,
  type SaleListing,
  type Viewing,
  type ViewingStatus,
} from "@prisma/client";
import { canTransitionBuyerInterest } from "@/lib/buyer-interest-fsm";
import { recordBuyerHistory } from "@/lib/buyer-history";
import { prisma } from "@/lib/prisma";
import type { CreateViewingInput } from "@/lib/validations/viewing-deposit";
import { formatDateTime } from "@/lib/format";

export class ViewingError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "CONFLICT" | "VALIDATION",
    readonly machineCode?: "SALE_LISTING_ALREADY_SOLD",
  ) {
    super(message);
    this.name = "ViewingError";
  }
}

const viewingInclude = {
  buyerInterest: {
    include: {
      buyer: true,
      saleListing: { include: { property: true } },
    },
  },
} as const;

type ViewingRecord = Viewing & {
  buyerInterest: BuyerInterest & {
    buyer: Buyer;
    saleListing: SaleListing & { property: Property };
  };
};

export type ViewingDTO = {
  id: string;
  buyerInterestId: string;
  scheduledAt: string;
  status: ViewingStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  buyerName: string;
  propertyName: string;
  saleListingId: string;
};

export function serializeViewing(viewing: ViewingRecord): ViewingDTO {
  return {
    id: viewing.id,
    buyerInterestId: viewing.buyerInterestId,
    scheduledAt: viewing.scheduledAt.toISOString(),
    status: viewing.status,
    notes: viewing.notes,
    createdAt: viewing.createdAt.toISOString(),
    updatedAt: viewing.updatedAt.toISOString(),
    buyerName: viewing.buyerInterest.buyer.name,
    propertyName:
      viewing.buyerInterest.saleListing.marketingTitle ||
      viewing.buyerInterest.saleListing.property.name,
    saleListingId: viewing.buyerInterest.saleListingId,
  };
}

export async function getViewingsByInterest(buyerInterestId: string) {
  return prisma.viewing.findMany({
    where: { buyerInterestId },
    include: viewingInclude,
    orderBy: { scheduledAt: "desc" },
  });
}

export async function getViewingsBySaleListing(saleListingId: string) {
  return prisma.viewing.findMany({
    where: { buyerInterest: { saleListingId } },
    include: viewingInclude,
    orderBy: { scheduledAt: "desc" },
  });
}

export async function getViewingById(id: string) {
  return prisma.viewing.findUnique({
    where: { id },
    include: viewingInclude,
  });
}

async function assertInterestOpen(buyerInterestId: string) {
  const interest = await prisma.buyerInterest.findUnique({
    where: { id: buyerInterestId },
    include: { saleListing: true },
  });
  if (!interest) {
    throw new ViewingError("Интерес не найден", "NOT_FOUND");
  }
  if (interest.saleListing.status === "SOLD") {
    throw new ViewingError("Объект уже продан", "CONFLICT", "SALE_LISTING_ALREADY_SOLD");
  }
  if (interest.status === "PURCHASED" || interest.status === "REFUSED") {
    throw new ViewingError(
      "Нельзя назначить показ для завершённого или отказанного интереса",
      "VALIDATION",
    );
  }
  return interest;
}

export async function scheduleViewing(buyerInterestId: string, input: CreateViewingInput) {
  const interest = await assertInterestOpen(buyerInterestId);
  const scheduledAt = new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new ViewingError("Некорректная дата показа", "VALIDATION");
  }

  return prisma.$transaction(async (tx) => {
    const viewing = await tx.viewing.create({
      data: {
        buyerInterestId,
        scheduledAt,
        status: "SCHEDULED",
        notes: input.notes ?? null,
      },
    });

    if (canTransitionBuyerInterest(interest.status, "VIEWING_SCHEDULED")) {
      await tx.buyerInterest.update({
        where: { id: buyerInterestId },
        data: { status: "VIEWING_SCHEDULED" },
      });
    }

    await recordBuyerHistory(
      {
        buyerId: interest.buyerId,
        buyerInterestId,
        type: "VIEWING_SCHEDULED",
        message: `Просмотр назначен на ${formatDateTime(scheduledAt)}`,
      },
      tx,
    );

    return tx.viewing.findUniqueOrThrow({
      where: { id: viewing.id },
      include: viewingInclude,
    });
  });
}

async function transitionViewing(
  id: string,
  nextStatus: Extract<ViewingStatus, "COMPLETED" | "CANCELLED" | "NO_SHOW">,
) {
  const current = await getViewingById(id);
  if (!current) {
    throw new ViewingError("Показ не найден", "NOT_FOUND");
  }
  if (current.status !== "SCHEDULED") {
    throw new ViewingError(
      `Показ в статусе ${current.status} нельзя изменить на ${nextStatus}`,
      "VALIDATION",
    );
  }

  const historyType =
    nextStatus === "COMPLETED"
      ? ("VIEWING_COMPLETED" as const)
      : nextStatus === "CANCELLED"
        ? ("VIEWING_CANCELLED" as const)
        : ("VIEWING_NO_SHOW" as const);
  const historyMessage =
    nextStatus === "COMPLETED"
      ? "Просмотр завершён"
      : nextStatus === "CANCELLED"
        ? "Просмотр отменён"
        : "Неявка на просмотр";

  return prisma.$transaction(async (tx) => {
    const viewing = await tx.viewing.update({
      where: { id },
      data: { status: nextStatus },
    });

    if (nextStatus === "COMPLETED") {
      const interest = await tx.buyerInterest.findUniqueOrThrow({
        where: { id: current.buyerInterestId },
      });
      if (canTransitionBuyerInterest(interest.status, "VIEWING_COMPLETED")) {
        await tx.buyerInterest.update({
          where: { id: interest.id },
          data: { status: "VIEWING_COMPLETED" },
        });
      }
    }

    await recordBuyerHistory(
      {
        buyerId: current.buyerInterest.buyerId,
        buyerInterestId: current.buyerInterestId,
        type: historyType,
        message: historyMessage,
      },
      tx,
    );

    return tx.viewing.findUniqueOrThrow({
      where: { id: viewing.id },
      include: viewingInclude,
    });
  });
}

export async function completeViewing(id: string) {
  return transitionViewing(id, "COMPLETED");
}

export async function cancelViewing(id: string) {
  return transitionViewing(id, "CANCELLED");
}

export async function markViewingNoShow(id: string) {
  return transitionViewing(id, "NO_SHOW");
}
