import type { BuyerHistory, BuyerHistoryType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type TxClient = Prisma.TransactionClient;

export type BuyerHistoryDTO = {
  id: string;
  buyerId: string;
  buyerInterestId: string | null;
  type: BuyerHistoryType;
  message: string | null;
  createdAt: string;
};

export function serializeBuyerHistory(entry: BuyerHistory): BuyerHistoryDTO {
  return {
    id: entry.id,
    buyerId: entry.buyerId,
    buyerInterestId: entry.buyerInterestId,
    type: entry.type,
    message: entry.message,
    createdAt: entry.createdAt.toISOString(),
  };
}

export async function recordBuyerHistory(
  input: {
    buyerId: string;
    buyerInterestId?: string | null;
    type: BuyerHistoryType;
    message?: string | null;
  },
  client: TxClient | typeof prisma = prisma,
) {
  return client.buyerHistory.create({
    data: {
      buyerId: input.buyerId,
      buyerInterestId: input.buyerInterestId ?? null,
      type: input.type,
      message: input.message ?? null,
    },
  });
}

export async function listBuyerHistory(
  buyerId: string,
  filters: { buyerInterestId?: string } = {},
) {
  return prisma.buyerHistory.findMany({
    where: {
      buyerId,
      buyerInterestId: filters.buyerInterestId,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listInterestHistory(buyerInterestId: string) {
  return prisma.buyerHistory.findMany({
    where: { buyerInterestId },
    orderBy: { createdAt: "desc" },
  });
}

export async function hasHistoryOfType(input: {
  buyerId: string;
  buyerInterestId?: string | null;
  type: BuyerHistoryType;
  message?: string | null;
}) {
  const existing = await prisma.buyerHistory.findFirst({
    where: {
      buyerId: input.buyerId,
      buyerInterestId: input.buyerInterestId ?? null,
      type: input.type,
      ...(input.message != null ? { message: input.message } : {}),
    },
  });
  return Boolean(existing);
}
