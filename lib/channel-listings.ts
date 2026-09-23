import {
  Prisma,
  type ChannelListing,
  type ChannelListingStatus,
  type ChannelSyncStatus,
  type SalesChannel,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSalesChannelById } from "@/lib/sales-channels";
import type {
  CreateChannelListingInput,
  UpdateChannelListingInput,
} from "@/lib/validations/channel-listing";

export class ChannelListingError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "CHANNEL_NOT_FOUND" | "CHANNEL_INACTIVE" | "CONFLICT",
  ) {
    super(message);
    this.name = "ChannelListingError";
  }
}

export type ChannelListingDTO = {
  id: string;
  propertyId: string;
  salesChannelId: string;
  externalId: string;
  externalUrl: string | null;
  status: ChannelListingStatus;
  syncStatus: ChannelSyncStatus;
  lastSyncAt: string | null;
  syncError: string | null;
  createdAt: string;
  updatedAt: string;
  salesChannel: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  };
};

type ListingWithChannel = ChannelListing & { salesChannel: SalesChannel };

export function serializeChannelListing(listing: ListingWithChannel): ChannelListingDTO {
  return {
    id: listing.id,
    propertyId: listing.propertyId,
    salesChannelId: listing.salesChannelId,
    externalId: listing.externalId,
    externalUrl: listing.externalUrl,
    status: listing.status,
    syncStatus: listing.syncStatus,
    lastSyncAt: listing.lastSyncAt?.toISOString() ?? null,
    syncError: listing.syncError,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
    salesChannel: {
      id: listing.salesChannel.id,
      code: listing.salesChannel.code,
      name: listing.salesChannel.name,
      isActive: listing.salesChannel.isActive,
    },
  };
}

const listingInclude = {
  salesChannel: true,
} as const;

function conflictFromPrisma(error: unknown, channelCode?: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = error.meta?.target;
    const fields = Array.isArray(target) ? target.join(",") : String(target ?? "");

    if (fields.includes("externalId")) {
      throw new ChannelListingError(
        channelCode === "AVITO"
          ? "Это объявление Авито уже привязано к другому объекту."
          : "Это объявление уже привязано к объекту",
        "CONFLICT",
      );
    }

    throw new ChannelListingError(
      "Этот канал уже привязан к объекту",
      "CONFLICT",
    );
  }

  throw error;
}

export async function getPropertyChannelListings(propertyId: string) {
  return prisma.channelListing.findMany({
    where: { propertyId },
    include: listingInclude,
    orderBy: { createdAt: "asc" },
  });
}

export async function getPropertyChannelListing(propertyId: string, listingId: string) {
  return prisma.channelListing.findFirst({
    where: { id: listingId, propertyId },
    include: listingInclude,
  });
}

export async function createChannelListing(
  propertyId: string,
  input: CreateChannelListingInput,
) {
  const channel = await getSalesChannelById(input.salesChannelId);

  if (!channel) {
    throw new ChannelListingError("Канал продаж не найден", "CHANNEL_NOT_FOUND");
  }

  if (!channel.isActive) {
    throw new ChannelListingError("Канал продаж отключён", "CHANNEL_INACTIVE");
  }

  try {
    return await prisma.channelListing.create({
      data: {
        propertyId,
        salesChannelId: input.salesChannelId,
        externalId: input.externalId,
        externalUrl: input.externalUrl,
        status: "ACTIVE",
        syncStatus: "CONNECTED",
        lastSyncAt: null,
        syncError: null,
      },
      include: listingInclude,
    });
  } catch (error) {
    conflictFromPrisma(error, channel.code);
  }
}

export async function updateChannelListing(
  propertyId: string,
  listingId: string,
  input: UpdateChannelListingInput,
) {
  const existing = await getPropertyChannelListing(propertyId, listingId);

  if (!existing) {
    throw new ChannelListingError("Привязка не найдена", "NOT_FOUND");
  }

  try {
    return await prisma.channelListing.update({
      where: { id: listingId },
      data: {
        ...input,
        syncStatus:
          input.status === "ACTIVE"
            ? "CONNECTED"
            : input.status === "INACTIVE"
              ? "NOT_CONNECTED"
              : undefined,
      },
      include: listingInclude,
    });
  } catch (error) {
    conflictFromPrisma(error, existing.salesChannel.code);
  }
}

export async function setChannelListingStatus(
  propertyId: string,
  listingId: string,
  status: ChannelListingStatus,
) {
  const existing = await getPropertyChannelListing(propertyId, listingId);

  if (!existing) {
    throw new ChannelListingError("Привязка не найдена", "NOT_FOUND");
  }

  if (status === "ACTIVE" && !existing.externalId.trim()) {
    throw new ChannelListingError("Нельзя подключить канал без ID объявления", "CHANNEL_INACTIVE");
  }

  return prisma.channelListing.update({
    where: { id: listingId },
    data: {
      status,
      syncStatus: status === "ACTIVE" ? "CONNECTED" : "NOT_CONNECTED",
      syncError: status === "ACTIVE" ? null : existing.syncError,
    },
    include: listingInclude,
  });
}

export async function deleteChannelListing(propertyId: string, listingId: string) {
  const existing = await getPropertyChannelListing(propertyId, listingId);

  if (!existing) {
    throw new ChannelListingError("Привязка не найдена", "NOT_FOUND");
  }

  await prisma.channelListing.delete({
    where: { id: listingId },
  });
}
