import type { GuestHistory, GuestHistoryType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type HistoryClient = Prisma.TransactionClient | typeof prisma;

export type GuestHistoryDTO = Omit<GuestHistory, "createdAt"> & {
  createdAt: string;
};

export function serializeGuestHistory(entry: GuestHistory): GuestHistoryDTO {
  return {
    ...entry,
    createdAt: entry.createdAt.toISOString(),
  };
}

export async function getGuestHistory(guestId: string) {
  return prisma.guestHistory.findMany({
    where: { guestId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createGuestHistory(
  input: {
    guestId: string;
    type: GuestHistoryType;
    title: string;
    description?: string | null;
  },
  client: HistoryClient = prisma,
) {
  return client.guestHistory.create({
    data: {
      guestId: input.guestId,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
    },
  });
}
