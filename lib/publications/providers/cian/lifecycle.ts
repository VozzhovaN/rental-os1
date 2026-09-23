import type { PublicationStatus } from "@prisma/client";
import { getLongTermListingById } from "@/lib/long-term-listings";
import { prisma } from "@/lib/prisma";
import {
  applyPublicationEvent,
  createPublication,
  getPublicationsForListing,
  PublicationError,
  serializePublication,
} from "@/lib/publications";
import {
  buildCianListingPreview,
  hashCianFlatRentPayload,
  prepareCianFeed,
} from "@/lib/publications/providers/cian/preview";
import { mapToCianFlatRentPayload } from "@/lib/publications/providers/cian/mapping";
import {
  CIAN_STATUS_SYNC,
  CIAN_UNPUBLISH,
  isCianStatusSyncAvailable,
  isCianUnpublishAvailable,
} from "@/lib/publications/providers/cian/env";

/** Statuses whose Object is included in the public CIAN long-term feed. */
export const CIAN_FEED_INCLUSION_STATUSES: PublicationStatus[] = [
  "PUBLISHING",
  "UPDATE_PENDING",
  "PUBLISHED",
];

export function isIncludedInCianFeed(status: PublicationStatus) {
  return CIAN_FEED_INCLUSION_STATUSES.includes(status);
}

export async function getCianSalesChannel() {
  const channel = await prisma.salesChannel.findUnique({ where: { code: "CIAN" } });
  if (!channel || !channel.isActive) {
    throw new PublicationError("Канал ЦИАН не найден или неактивен", "VALIDATION");
  }
  return channel;
}

export async function getCianPublicationForListing(longTermListingId: string) {
  const publications = await getPublicationsForListing(longTermListingId);
  return publications.find((item) => item.salesChannel.code === "CIAN") ?? null;
}

/**
 * Prepare listing for CIAN feed inclusion.
 * NOT_PUBLISHED → PUBLISHING via FSM. Never marks PUBLISHED.
 */
export async function prepareCianPublication(longTermListingId: string) {
  const listing = await getLongTermListingById(longTermListingId);
  if (!listing) {
    throw new PublicationError("Карточка долгосрочной аренды не найдена", "NOT_FOUND");
  }

  if (listing.status !== "ACTIVE") {
    throw new PublicationError("В фид ЦИАН можно подготовить только ACTIVE карточку", "VALIDATION");
  }

  const preview = buildCianListingPreview(listing);
  if (!preview.ready || !preview.cianPayloadHash) {
    throw new PublicationError(
      preview.ready ? "CIAN payload недоступен" : "Карточка не готова к CIAN XML",
      "VALIDATION",
    );
  }

  const channel = await getCianSalesChannel();
  const existing = await getCianPublicationForListing(listing.id);
  const created = existing
    ? { publication: existing, created: false as const }
    : await createPublication({
        longTermListingId: listing.id,
        salesChannelId: channel.id,
      });

  let publication = created.publication;

  if (publication.status === "NOT_PUBLISHED" || publication.status === "UNPUBLISHED") {
    publication = await applyPublicationEvent(publication.id, "START_PUBLISH", {
      lastSerializedHash: preview.cianPayloadHash,
    });
  } else if (publication.status === "ERROR" && !publication.externalId) {
    publication = await applyPublicationEvent(publication.id, "START_PUBLISH", {
      lastSerializedHash: preview.cianPayloadHash,
    });
  } else if (publication.status === "PUBLISHED") {
    const currentHash = preview.cianPayloadHash;
    if (publication.lastSerializedHash && publication.lastSerializedHash !== currentHash) {
      publication = await applyPublicationEvent(publication.id, "START_UPDATE", {
        lastSerializedHash: preview.cianPayloadHash,
      });
    } else {
      publication = await prisma.publication.update({
        where: { id: publication.id },
        data: { lastSerializedHash: preview.cianPayloadHash },
        include: { salesChannel: true },
      });
    }
  } else {
    publication = await prisma.publication.update({
      where: { id: publication.id },
      data: { lastSerializedHash: preview.cianPayloadHash },
      include: { salesChannel: true },
    });
  }

  return {
    publication: serializePublication(publication),
    preview,
    blockers: {
      statusSync: CIAN_STATUS_SYNC,
      unpublish: CIAN_UNPUBLISH,
      statusSyncAvailable: isCianStatusSyncAvailable(),
      unpublishAvailable: isCianUnpublishAvailable(),
    },
  };
}

/**
 * If PUBLISHED and provider payload changed → UPDATE_PENDING.
 * Does not invent PUBLISHED.
 */
export async function detectCianPayloadUpdate(longTermListingId: string) {
  const listing = await getLongTermListingById(longTermListingId);
  if (!listing) {
    throw new PublicationError("Карточка долгосрочной аренды не найдена", "NOT_FOUND");
  }

  const publication = await getCianPublicationForListing(listing.id);
  if (!publication) {
    return { publication: null, payloadChanged: false, transitioned: false };
  }

  const preview = buildCianListingPreview(listing);
  const currentHash = preview.ready ? preview.cianPayloadHash : null;
  const payloadChanged = Boolean(
    currentHash &&
      publication.lastSerializedHash &&
      currentHash !== publication.lastSerializedHash,
  );

  if (publication.status === "PUBLISHED" && payloadChanged) {
    const updated = await applyPublicationEvent(publication.id, "START_UPDATE", {});
    return {
      publication: serializePublication(updated),
      payloadChanged: true,
      transitioned: true,
      currentHash,
    };
  }

  return {
    publication: serializePublication(publication),
    payloadChanged,
    transitioned: false,
    currentHash,
  };
}

export type CianPublicationDiagnosticsView = {
  publication: ReturnType<typeof serializePublication> | null;
  includedInFeed: boolean;
  payloadChanged: boolean;
  currentHash: string | null;
  lastSerializedHash: string | null;
  statusSync: typeof CIAN_STATUS_SYNC;
  unpublish: typeof CIAN_UNPUBLISH;
  canPrepare: boolean;
  canConfirmPublished: false;
  canUnpublish: false;
};

export async function getCianPublicationDiagnostics(
  longTermListingId: string,
): Promise<CianPublicationDiagnosticsView> {
  const listing = await getLongTermListingById(longTermListingId);
  if (!listing) {
    throw new PublicationError("Карточка долгосрочной аренды не найдена", "NOT_FOUND");
  }

  await detectCianPayloadUpdate(longTermListingId).catch(() => null);

  const publication = await getCianPublicationForListing(longTermListingId);
  const preview = buildCianListingPreview(listing);
  const currentHash = preview.ready ? preview.cianPayloadHash : null;
  const lastSerializedHash = publication?.lastSerializedHash ?? null;
  const payloadChanged = Boolean(
    currentHash && lastSerializedHash && currentHash !== lastSerializedHash,
  );

  const dto = publication ? serializePublication(publication) : null;

  return {
    publication: dto,
    includedInFeed: dto ? isIncludedInCianFeed(dto.status) : false,
    payloadChanged,
    currentHash,
    lastSerializedHash,
    statusSync: CIAN_STATUS_SYNC,
    unpublish: CIAN_UNPUBLISH,
    canPrepare:
      preview.ready &&
      listing.status === "ACTIVE" &&
      (!dto ||
        dto.status === "NOT_PUBLISHED" ||
        dto.status === "UNPUBLISHED" ||
        (dto.status === "ERROR" && !dto.externalId) ||
        (dto.status === "PUBLISHED" && payloadChanged)),
    canConfirmPublished: false,
    canUnpublish: false,
  };
}

/**
 * One account → one feed → many listings with CIAN Publications in inclusion statuses.
 */
export async function buildPublicCianLongTermFeed() {
  const channel = await prisma.salesChannel.findUnique({ where: { code: "CIAN" } });
  if (!channel) {
    return prepareCianFeed([]);
  }

  const publications = await prisma.publication.findMany({
    where: {
      salesChannelId: channel.id,
      status: { in: CIAN_FEED_INCLUSION_STATUSES },
      listing: { status: "ACTIVE" },
    },
    include: {
      listing: {
        include: {
          property: true,
          photos: {
            include: { photo: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return prepareCianFeed(publications.map((item) => item.listing));
}

/** Test helper: hash for a listing without DB write. */
export function computeCianPayloadHashForListing(
  listing: NonNullable<Awaited<ReturnType<typeof getLongTermListingById>>>,
) {
  const preview = buildCianListingPreview(listing);
  if (!preview.ready || !preview.payload) {
    return null;
  }
  return hashCianFlatRentPayload(mapToCianFlatRentPayload(preview.normalized));
}
