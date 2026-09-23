import { Prisma, type Publication, type PublicationStatus, type SalesChannel } from "@prisma/client";
import { redactSecrets } from "@/lib/integrations/crypto";
import { getLongTermListingById } from "@/lib/long-term-listings";
import { prisma } from "@/lib/prisma";
import { isLongTermPublicationChannelCode } from "@/lib/sales-channel-codes";
import { serializeSalesChannel, type SalesChannelDTO } from "@/lib/sales-channels";
import {
  assertPublicationTransition,
  type PublicationEvent,
} from "@/lib/publications/state-machine";

export class PublicationError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "CONFLICT" | "VALIDATION",
  ) {
    super(message);
    this.name = "PublicationError";
  }
}

const publicationInclude = {
  salesChannel: true,
} as const;

type PublicationRecord = Publication & { salesChannel: SalesChannel };

export type PublicationDTO = {
  id: string;
  longTermListingId: string;
  salesChannelId: string;
  status: PublicationStatus;
  externalId: string | null;
  externalStatus: string | null;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  lastSerializedHash: string | null;
  createdAt: string;
  updatedAt: string;
  salesChannel: SalesChannelDTO;
};

export type ProviderResultInput = {
  externalId?: string | null;
  externalStatus?: string | null;
  error?: string | null;
  lastSerializedHash?: string | null;
};

export function serializePublication(publication: PublicationRecord): PublicationDTO {
  return {
    id: publication.id,
    longTermListingId: publication.longTermListingId,
    salesChannelId: publication.salesChannelId,
    status: publication.status,
    externalId: publication.externalId,
    externalStatus: publication.externalStatus,
    lastSyncAt: publication.lastSyncAt?.toISOString() ?? null,
    lastSuccessAt: publication.lastSuccessAt?.toISOString() ?? null,
    lastErrorAt: publication.lastErrorAt?.toISOString() ?? null,
    lastError: publication.lastError,
    lastSerializedHash: publication.lastSerializedHash,
    createdAt: publication.createdAt.toISOString(),
    updatedAt: publication.updatedAt.toISOString(),
    salesChannel: serializeSalesChannel(publication.salesChannel),
  };
}

export async function getPublicationsForListing(longTermListingId: string) {
  return prisma.publication.findMany({
    where: { longTermListingId },
    include: publicationInclude,
    orderBy: { createdAt: "asc" },
  });
}

export async function getPublicationById(id: string) {
  return prisma.publication.findUnique({
    where: { id },
    include: publicationInclude,
  });
}

export async function getPublicationForListing(longTermListingId: string, publicationId: string) {
  return prisma.publication.findFirst({
    where: { id: publicationId, longTermListingId },
    include: publicationInclude,
  });
}

export async function createPublication(input: {
  longTermListingId: string;
  salesChannelId: string;
}) {
  const listing = await getLongTermListingById(input.longTermListingId);

  if (!listing) {
    throw new PublicationError("Карточка долгосрочной аренды не найдена", "NOT_FOUND");
  }

  if (listing.status === "ARCHIVED") {
    throw new PublicationError("Нельзя создать публикацию для архивной карточки", "VALIDATION");
  }

  const channel = await prisma.salesChannel.findUnique({
    where: { id: input.salesChannelId },
  });

  if (!channel) {
    throw new PublicationError("Канал продаж не найден", "NOT_FOUND");
  }

  if (!isLongTermPublicationChannelCode(channel.code)) {
    throw new PublicationError("Канал не поддерживает долгосрочную публикацию", "VALIDATION");
  }

  if (!channel.isActive) {
    throw new PublicationError("Канал продаж неактивен", "VALIDATION");
  }

  const existing = await prisma.publication.findUnique({
    where: {
      longTermListingId_salesChannelId: {
        longTermListingId: listing.id,
        salesChannelId: channel.id,
      },
    },
    include: publicationInclude,
  });

  if (existing) {
    return { publication: existing, created: false as const };
  }

  try {
    const publication = await prisma.publication.create({
      data: {
        longTermListingId: listing.id,
        salesChannelId: channel.id,
        status: "NOT_PUBLISHED",
      },
      include: publicationInclude,
    });
    return { publication, created: true as const };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const publication = await prisma.publication.findUnique({
        where: {
          longTermListingId_salesChannelId: {
            longTermListingId: listing.id,
            salesChannelId: channel.id,
          },
        },
        include: publicationInclude,
      });
      if (publication) {
        return { publication, created: false as const };
      }
    }
    throw error;
  }
}

async function loadPublication(id: string) {
  const publication = await getPublicationById(id);

  if (!publication) {
    throw new PublicationError("Публикация не найдена", "NOT_FOUND");
  }

  return publication;
}

export async function applyPublicationEvent(
  id: string,
  event: PublicationEvent,
  result: ProviderResultInput = {},
) {
  const current = await loadPublication(id);
  let nextStatus: PublicationStatus;

  try {
    nextStatus = assertPublicationTransition(current.status, event, {
      externalId: current.externalId,
    });
  } catch {
    throw new PublicationError("Недопустимый переход статуса публикации", "VALIDATION");
  }

  const now = new Date();
  const failed = nextStatus === "ERROR";
  const succeeded = event === "CONFIRM_PUBLISHED" || event === "CONFIRM_UNPUBLISHED";
  const safeError = failed
    ? redactSecrets(result.error ?? current.lastError ?? "Ошибка публикации")
    : current.lastError;

  return prisma.publication.update({
    where: { id },
    data: {
      status: nextStatus,
      lastSyncAt: now,
      lastErrorAt: failed ? now : current.lastErrorAt,
      lastError: failed ? safeError : succeeded ? null : current.lastError,
      lastSuccessAt: succeeded ? now : current.lastSuccessAt,
      externalStatus:
        result.externalStatus === undefined ? current.externalStatus : result.externalStatus,
      externalId: result.externalId === undefined ? current.externalId : result.externalId,
      lastSerializedHash:
        result.lastSerializedHash === undefined
          ? current.lastSerializedHash
          : result.lastSerializedHash,
    },
    include: publicationInclude,
  });
}

export async function recordPublicationFailure(id: string, error: string) {
  return applyPublicationEvent(id, "FAIL", { error });
}
