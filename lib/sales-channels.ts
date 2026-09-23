import type { SalesChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SALES_CHANNEL_CODES } from "@/lib/sales-channel-codes";

export type SalesChannelDTO = Omit<SalesChannel, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export function serializeSalesChannel(channel: SalesChannel): SalesChannelDTO {
  return {
    ...channel,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
  };
}

function sortChannels<T extends { code: string }>(channels: T[]) {
  return [...channels].sort((left, right) => {
    const leftIndex = SALES_CHANNEL_CODES.indexOf(
      left.code as (typeof SALES_CHANNEL_CODES)[number],
    );
    const rightIndex = SALES_CHANNEL_CODES.indexOf(
      right.code as (typeof SALES_CHANNEL_CODES)[number],
    );

    return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
  });
}

export async function getActiveSalesChannels() {
  const channels = await prisma.salesChannel.findMany({
    where: { isActive: true },
  });

  return sortChannels(channels);
}

export async function getSalesChannelById(id: string) {
  return prisma.salesChannel.findUnique({
    where: { id },
  });
}

export async function getSalesChannelByCode(code: string) {
  return prisma.salesChannel.findUnique({
    where: { code },
  });
}
