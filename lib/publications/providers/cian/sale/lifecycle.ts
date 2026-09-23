import type { PublicationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CIAN_STATUS_SYNC,
  CIAN_UNPUBLISH,
} from "@/lib/publications/providers/cian/env";
import {
  buildCianSaleListingPreview,
  prepareCianSaleFeed,
} from "@/lib/publications/providers/cian/sale/preview";
import { getSaleListingById } from "@/lib/sale-listings";
import {
  applySalePublicationEvent,
  createSalePublication,
  getSalePublicationsForListing,
  SalePublicationError,
  serializeSalePublication,
  toSalePublicationListingSource,
} from "@/lib/sale-publications";

/** Same inclusion set as long-term CIAN feed. */
export const CIAN_SALE_FEED_INCLUSION_STATUSES: PublicationStatus[] = [
  "PUBLISHING",
  "UPDATE_PENDING",
  "PUBLISHED",
];

export const CIAN_SALE_STATUS_SYNC = "BLOCKED_BY_PROVIDER_ACCESS" as const;
export const CIAN_SALE_UNPUBLISH = "BLOCKED_BY_PROVIDER_CONFIRMATION" as const;

/** Explicit capability metadata for Stage 10.3 provider matrix. */
export const CIAN_SALE_CAPABILITIES = {
  code: "CIAN" as const,
  feed: "READY" as const,
  preview: "READY" as const,
  statusSync: CIAN_SALE_STATUS_SYNC,
  unpublish: CIAN_SALE_UNPUBLISH,
  credentialsRequired: false,
  blockerReason: null as string | null,
};

export function isIncludedInCianSaleFeed(status: PublicationStatus) {
  return CIAN_SALE_FEED_INCLUSION_STATUSES.includes(status);
}

export async function getCianSaleSalesChannel() {
  const channel = await prisma.salesChannel.findUnique({ where: { code: "CIAN" } });
  if (!channel || !channel.isActive) {
    throw new SalePublicationError("Канал ЦИАН не найден или неактивен", "VALIDATION");
  }
  return channel;
}

export async function getCianSalePublicationForListing(saleListingId: string) {
  const publications = await getSalePublicationsForListing(saleListingId);
  return publications.find((item) => item.salesChannel.code === "CIAN") ?? null;
}

/**
 * Prepare SaleListing for CIAN sale feed inclusion.
 * Never marks PUBLISHED. Uses cianPayloadHash for lastSerializedHash.
 */
export async function prepareCianSalePublication(saleListingId: string) {
  const listing = await getSaleListingById(saleListingId);
  if (!listing) {
    throw new SalePublicationError("Карточка продажи не найдена", "NOT_FOUND");
  }

  if (listing.status === "SOLD") {
    throw new SalePublicationError(
      "Объект продан. Новая публикация недоступна",
      "VALIDATION",
    );
  }

  if (listing.status !== "ACTIVE") {
    throw new SalePublicationError(
      "В фид ЦИАН sale можно подготовить только ACTIVE карточку",
      "VALIDATION",
    );
  }

  const source = toSalePublicationListingSource(listing);
  const preview = buildCianSaleListingPreview(source);
  if (!preview.ready || !preview.cianPayloadHash) {
    throw new SalePublicationError(
      preview.ready ? "CIAN sale payload недоступен" : "Карточка не готова к CIAN sale XML",
      "VALIDATION",
    );
  }

  const channel = await getCianSaleSalesChannel();
  const existing = await getCianSalePublicationForListing(listing.id);
  const created = existing
    ? { publication: existing, created: false as const }
    : await createSalePublication({
        saleListingId: listing.id,
        salesChannelId: channel.id,
      });

  let publication = created.publication;

  if (publication.status === "NOT_PUBLISHED" || publication.status === "UNPUBLISHED") {
    publication = await applySalePublicationEvent(publication.id, "START_PUBLISH", {
      lastSerializedHash: preview.cianPayloadHash,
    });
  } else if (publication.status === "ERROR" && !publication.externalId) {
    publication = await applySalePublicationEvent(publication.id, "START_PUBLISH", {
      lastSerializedHash: preview.cianPayloadHash,
    });
  } else if (publication.status === "PUBLISHED") {
    const currentHash = preview.cianPayloadHash;
    if (publication.lastSerializedHash && publication.lastSerializedHash !== currentHash) {
      publication = await applySalePublicationEvent(publication.id, "START_UPDATE", {
        lastSerializedHash: preview.cianPayloadHash,
      });
    } else {
      publication = await prisma.salePublication.update({
        where: { id: publication.id },
        data: { lastSerializedHash: preview.cianPayloadHash },
        include: { salesChannel: true },
      });
    }
  } else {
    publication = await prisma.salePublication.update({
      where: { id: publication.id },
      data: { lastSerializedHash: preview.cianPayloadHash },
      include: { salesChannel: true },
    });
  }

  return {
    publication: serializeSalePublication(publication, {
      currentPayloadHash: preview.cianPayloadHash,
    }),
    preview,
    prepared: true as const,
    published: false as const,
    blockers: {
      statusSync: CIAN_SALE_STATUS_SYNC,
      unpublish: CIAN_SALE_UNPUBLISH,
      legacyStatusSync: CIAN_STATUS_SYNC,
      legacyUnpublish: CIAN_UNPUBLISH,
    },
  };
}

export async function detectCianSalePayloadUpdate(saleListingId: string) {
  const listing = await getSaleListingById(saleListingId);
  if (!listing) {
    throw new SalePublicationError("Карточка продажи не найдена", "NOT_FOUND");
  }

  const publication = await getCianSalePublicationForListing(listing.id);
  if (!publication) {
    return { publication: null, payloadChanged: false, transitioned: false };
  }

  const preview = buildCianSaleListingPreview(toSalePublicationListingSource(listing));
  const currentHash = preview.ready ? preview.cianPayloadHash : null;
  const payloadChanged = Boolean(
    currentHash &&
      publication.lastSerializedHash &&
      currentHash !== publication.lastSerializedHash,
  );

  if (publication.status === "PUBLISHED" && payloadChanged) {
    const updated = await applySalePublicationEvent(publication.id, "START_UPDATE", {});
    return {
      publication: serializeSalePublication(updated, { currentPayloadHash: currentHash }),
      payloadChanged: true,
      transitioned: true,
      currentHash,
    };
  }

  return {
    publication: serializeSalePublication(publication, { currentPayloadHash: currentHash }),
    payloadChanged,
    transitioned: false,
    currentHash,
  };
}

export type CianSalePublicationDiagnosticsView = {
  publication: ReturnType<typeof serializeSalePublication> | null;
  includedInFeed: boolean;
  payloadChanged: boolean;
  currentHash: string | null;
  lastSerializedHash: string | null;
  statusSync: typeof CIAN_SALE_STATUS_SYNC;
  unpublish: typeof CIAN_SALE_UNPUBLISH;
  canPrepare: boolean;
  canConfirmPublished: false;
  canUnpublish: false;
  soldBlocked: boolean;
};

export async function getCianSalePublicationDiagnostics(
  saleListingId: string,
): Promise<CianSalePublicationDiagnosticsView> {
  const listing = await getSaleListingById(saleListingId);
  if (!listing) {
    throw new SalePublicationError("Карточка продажи не найдена", "NOT_FOUND");
  }

  await detectCianSalePayloadUpdate(saleListingId).catch(() => null);

  const publication = await getCianSalePublicationForListing(saleListingId);
  const preview = buildCianSaleListingPreview(toSalePublicationListingSource(listing));
  const currentHash = preview.ready ? preview.cianPayloadHash : null;
  const lastSerializedHash = publication?.lastSerializedHash ?? null;
  const payloadChanged = Boolean(
    currentHash && lastSerializedHash && currentHash !== lastSerializedHash,
  );

  const dto = publication
    ? serializeSalePublication(publication, { currentPayloadHash: currentHash })
    : null;

  const soldBlocked = listing.status === "SOLD";

  return {
    publication: dto,
    includedInFeed:
      !soldBlocked && dto ? isIncludedInCianSaleFeed(dto.status) && listing.status === "ACTIVE" : false,
    payloadChanged,
    currentHash,
    lastSerializedHash,
    statusSync: CIAN_SALE_STATUS_SYNC,
    unpublish: CIAN_SALE_UNPUBLISH,
    canPrepare:
      !soldBlocked &&
      preview.ready &&
      listing.status === "ACTIVE" &&
      (!dto ||
        dto.status === "NOT_PUBLISHED" ||
        dto.status === "UNPUBLISHED" ||
        (dto.status === "ERROR" && !dto.externalId) ||
        (dto.status === "PUBLISHED" && payloadChanged)),
    canConfirmPublished: false,
    canUnpublish: false,
    soldBlocked,
  };
}

/**
 * Public CIAN sale feed — separate from long-term rent feed.
 * Eligible: ACTIVE SaleListing + CIAN SalePublication in inclusion statuses
 * + baseline + CIAN sale validation.
 */
export async function buildPublicCianSaleFeed() {
  const channel = await prisma.salesChannel.findUnique({ where: { code: "CIAN" } });
  if (!channel) {
    return prepareCianSaleFeed([]);
  }

  const publications = await prisma.salePublication.findMany({
    where: {
      salesChannelId: channel.id,
      status: { in: CIAN_SALE_FEED_INCLUSION_STATUSES },
      listing: { status: "ACTIVE" },
    },
    include: {
      listing: {
        include: {
          property: true,
          photos: {
            include: { propertyPhoto: true },
            orderBy: { order: "asc" },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return prepareCianSaleFeed(publications.map((item) => toSalePublicationListingSource(item.listing)));
}
