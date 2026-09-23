import type { BuyerInterestStatus } from "@prisma/client";
import { canTransitionBuyerInterest } from "@/lib/buyer-interest-fsm";
import {
  getBuyerInterestById,
  serializeBuyerInterest,
} from "@/lib/buyer-interests";
import { hasHistoryOfType, recordBuyerHistory } from "@/lib/buyer-history";
import { prisma } from "@/lib/prisma";
import { serializeSaleListing } from "@/lib/sale-listings";

export class PurchaseError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "CONFLICT" | "VALIDATION",
    readonly machineCode?: "SALE_LISTING_ALREADY_SOLD",
  ) {
    super(message);
    this.name = "PurchaseError";
  }
}

const REFUSAL_MESSAGE = "Объект продан другому покупателю";
const PURCHASE_MESSAGE = "Покупка завершена";

/**
 * Complete purchase for a BuyerInterest (requires DEPOSIT_PAID).
 * Atomic: winner PURCHASED + SaleListing SOLD + refuse others + history.
 * SQLite: no row-level locks; race windows remain possible under concurrent writers.
 */
export async function completePurchase(buyerInterestId: string) {
  const current = await getBuyerInterestById(buyerInterestId);
  if (!current) {
    throw new PurchaseError("Интерес не найден", "NOT_FOUND");
  }

  // Idempotent success for the same winning interest.
  if (current.status === "PURCHASED" && current.saleListing.status === "SOLD") {
    const alreadyLogged = await hasHistoryOfType({
      buyerId: current.buyerId,
      buyerInterestId: current.id,
      type: "PURCHASE_COMPLETED",
      message: PURCHASE_MESSAGE,
    });
    return {
      interest: serializeBuyerInterest(current),
      listing: serializeSaleListing(current.saleListing),
      created: false as const,
      historyWritten: alreadyLogged,
    };
  }

  if (current.status === "REFUSED") {
    throw new PurchaseError("Отказной интерес нельзя провести в покупку", "VALIDATION");
  }
  if (current.status !== "DEPOSIT_PAID") {
    throw new PurchaseError(
      "Покупка доступна только при статусе «Задаток внесён»",
      "VALIDATION",
    );
  }
  if (current.saleListing.status === "ARCHIVED") {
    throw new PurchaseError("Нельзя завершить покупку по архивной карточке", "VALIDATION");
  }
  if (current.saleListing.status === "SOLD") {
    throw new PurchaseError(
      "Объект уже продан",
      "CONFLICT",
      "SALE_LISTING_ALREADY_SOLD",
    );
  }
  if (!canTransitionBuyerInterest(current.status, "PURCHASED")) {
    throw new PurchaseError(
      `Переход ${current.status} → PURCHASED недопустим`,
      "VALIDATION",
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const listing = await tx.saleListing.findUniqueOrThrow({
      where: { id: current.saleListingId },
    });
    if (listing.status === "SOLD") {
      throw new PurchaseError(
        "Объект уже продан",
        "CONFLICT",
        "SALE_LISTING_ALREADY_SOLD",
      );
    }

    const interest = await tx.buyerInterest.findUniqueOrThrow({
      where: { id: buyerInterestId },
    });
    if (interest.status === "PURCHASED") {
      // Concurrent idempotent path inside tx
      return { winnerId: interest.id, created: false as const };
    }
    if (interest.status !== "DEPOSIT_PAID") {
      throw new PurchaseError(
        "Покупка доступна только при статусе «Задаток внесён»",
        "VALIDATION",
      );
    }

    const otherPurchased = await tx.buyerInterest.findFirst({
      where: {
        saleListingId: current.saleListingId,
        status: "PURCHASED",
        id: { not: buyerInterestId },
      },
    });
    if (otherPurchased) {
      throw new PurchaseError(
        "Объект уже продан другому покупателю",
        "CONFLICT",
        "SALE_LISTING_ALREADY_SOLD",
      );
    }

    await tx.buyerInterest.update({
      where: { id: buyerInterestId },
      data: { status: "PURCHASED" },
    });
    await tx.saleListing.update({
      where: { id: current.saleListingId },
      data: { status: "SOLD" },
    });

    await recordBuyerHistory(
      {
        buyerId: current.buyerId,
        buyerInterestId,
        type: "PURCHASE_COMPLETED",
        message: PURCHASE_MESSAGE,
      },
      tx,
    );

    const others = await tx.buyerInterest.findMany({
      where: {
        saleListingId: current.saleListingId,
        id: { not: buyerInterestId },
        status: { notIn: ["PURCHASED", "REFUSED"] },
      },
    });

    for (const other of others) {
      if (!canTransitionBuyerInterest(other.status as BuyerInterestStatus, "REFUSED")) {
        continue;
      }
      await tx.buyerInterest.update({
        where: { id: other.id },
        data: { status: "REFUSED" },
      });
      await recordBuyerHistory(
        {
          buyerId: other.buyerId,
          buyerInterestId: other.id,
          type: "REFUSED",
          message: REFUSAL_MESSAGE,
        },
        tx,
      );
    }

    return { winnerId: buyerInterestId, created: true as const };
  });

  const refreshed = await getBuyerInterestById(result.winnerId);
  if (!refreshed) {
    throw new PurchaseError("Интерес не найден после покупки", "NOT_FOUND");
  }

  return {
    interest: serializeBuyerInterest(refreshed),
    listing: serializeSaleListing(refreshed.saleListing),
    created: result.created,
    historyWritten: true,
  };
}
