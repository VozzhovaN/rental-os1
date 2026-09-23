import { redactSecrets } from "@/lib/integrations/crypto";
import { prisma } from "@/lib/prisma";
import {
  buildNormalizedSalePublicationData,
  hashNormalizedSalePublicationData,
  type SalePublicationListingSource,
} from "@/lib/publications/normalized-sale";
import {
  getSalePublicationReadiness,
  SALE_PROVIDER_MAPPING_STATUS,
  validateSalePublicationReadiness,
} from "@/lib/publications/sale-readiness";
import {
  assertPublicationTransition,
  type PublicationEvent,
} from "@/lib/publications/state-machine";
import { AVITO_SALE_CAPABILITIES } from "@/lib/publications/providers/avito/sale/capabilities";
import { DOMCLICK_SALE_CAPABILITIES } from "@/lib/publications/providers/domclick/sale/capabilities";
import { isSaleProviderFeedReady } from "@/lib/publications/providers/sale-capabilities";
import { getSaleListingById } from "@/lib/sale-listings";
import { serializeSalesChannel, type SalesChannelDTO } from "@/lib/sales-channels";
import { isSalePublicationChannelCode } from "@/lib/sales-channel-codes";
import {
  Prisma,
  type PublicationStatus,
  type SalePublication,
  type SalesChannel,
} from "@prisma/client";

export class SalePublicationError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "CONFLICT" | "VALIDATION",
  ) {
    super(message);
    this.name = "SalePublicationError";
  }
}

const publicationInclude = {
  salesChannel: true,
} as const;

type SalePublicationRecord = SalePublication & { salesChannel: SalesChannel };

export type SalePublicationDTO = {
  id: string;
  saleListingId: string;
  salesChannelId: string;
  status: PublicationStatus;
  externalId: string | null;
  externalStatus: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  lastSerializedHash: string | null;
  payloadChanged: boolean | null;
  providerMappingStatus: typeof SALE_PROVIDER_MAPPING_STATUS;
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

export function serializeSalePublication(
  publication: SalePublicationRecord,
  options: { currentPayloadHash?: string | null } = {},
): SalePublicationDTO {
  const payloadChanged =
    options.currentPayloadHash != null && publication.lastSerializedHash != null
      ? options.currentPayloadHash !== publication.lastSerializedHash
      : null;

  return {
    id: publication.id,
    saleListingId: publication.saleListingId,
    salesChannelId: publication.salesChannelId,
    status: publication.status,
    externalId: publication.externalId,
    externalStatus: publication.externalStatus,
    lastAttemptAt: publication.lastAttemptAt?.toISOString() ?? null,
    lastSuccessAt: publication.lastSuccessAt?.toISOString() ?? null,
    lastErrorAt: publication.lastErrorAt?.toISOString() ?? null,
    lastError: publication.lastError,
    lastSerializedHash: publication.lastSerializedHash,
    payloadChanged,
    providerMappingStatus: SALE_PROVIDER_MAPPING_STATUS,
    createdAt: publication.createdAt.toISOString(),
    updatedAt: publication.updatedAt.toISOString(),
    salesChannel: serializeSalesChannel(publication.salesChannel),
  };
}

export function toSalePublicationListingSource(
  listing: NonNullable<Awaited<ReturnType<typeof getSaleListingById>>>,
): SalePublicationListingSource {
  return {
    id: listing.id,
    propertyId: listing.propertyId,
    status: listing.status,
    price: listing.price,
    marketingTitle: listing.marketingTitle,
    description: listing.description,
    specialOfferPrice: listing.specialOfferPrice,
    specialOfferText: listing.specialOfferText,
    advantages: listing.advantages,
    infrastructure: listing.infrastructure,
    security: listing.security,
    parking: listing.parking,
    transport: listing.transport,
    publicationContactName: listing.publicationContactName,
    publicationPhoneCountryCode: listing.publicationPhoneCountryCode,
    publicationPhoneNumber: listing.publicationPhoneNumber,
    property: {
      type: listing.property.type,
      address: listing.property.address,
      city: listing.property.city,
      district: listing.property.district,
      area: listing.property.area,
      rooms: listing.property.rooms,
      floor: listing.property.floor,
      totalFloors: listing.property.totalFloors,
    },
    photos: listing.photos.map((item) => ({
      order: item.order,
      propertyPhoto: {
        id: item.propertyPhoto.id,
        url: item.propertyPhoto.url,
      },
    })),
  };
}

export async function getSalePublicationsForListing(saleListingId: string) {
  return prisma.salePublication.findMany({
    where: { saleListingId },
    include: publicationInclude,
    orderBy: { createdAt: "asc" },
  });
}

export async function getSalePublicationById(id: string) {
  return prisma.salePublication.findUnique({
    where: { id },
    include: publicationInclude,
  });
}

export async function getSalePublicationForListing(saleListingId: string, publicationId: string) {
  return prisma.salePublication.findFirst({
    where: { id: publicationId, saleListingId },
    include: publicationInclude,
  });
}

export async function createSalePublication(input: {
  saleListingId: string;
  salesChannelId: string;
}) {
  const listing = await getSaleListingById(input.saleListingId);

  if (!listing) {
    throw new SalePublicationError("Карточка продажи не найдена", "NOT_FOUND");
  }

  if (listing.status === "SOLD") {
    throw new SalePublicationError(
      "Объект уже продан. Новая публикация недоступна",
      "VALIDATION",
    );
  }

  if (listing.status === "ARCHIVED") {
    throw new SalePublicationError(
      "Нельзя создать публикацию для архивной карточки продажи",
      "VALIDATION",
    );
  }

  const channel = await prisma.salesChannel.findUnique({
    where: { id: input.salesChannelId },
  });

  if (!channel) {
    throw new SalePublicationError("Канал продаж не найден", "NOT_FOUND");
  }

  if (!isSalePublicationChannelCode(channel.code)) {
    throw new SalePublicationError("Канал не поддерживает публикацию продажи", "VALIDATION");
  }

  if (!channel.isActive) {
    throw new SalePublicationError("Канал продаж неактивен", "VALIDATION");
  }

  const existing = await prisma.salePublication.findUnique({
    where: {
      saleListingId_salesChannelId: {
        saleListingId: listing.id,
        salesChannelId: channel.id,
      },
    },
    include: publicationInclude,
  });

  if (existing) {
    return { publication: existing, created: false as const };
  }

  try {
    const publication = await prisma.salePublication.create({
      data: {
        saleListingId: listing.id,
        salesChannelId: channel.id,
        status: "NOT_PUBLISHED",
      },
      include: publicationInclude,
    });
    return { publication, created: true as const };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const publication = await prisma.salePublication.findUnique({
        where: {
          saleListingId_salesChannelId: {
            saleListingId: listing.id,
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

async function loadSalePublication(id: string) {
  const publication = await getSalePublicationById(id);
  if (!publication) {
    throw new SalePublicationError("Публикация продажи не найдена", "NOT_FOUND");
  }
  return publication;
}

function assertProviderAllowsPublishConfirmation(channelCode: string) {
  if (channelCode === "AVITO") {
    throw new SalePublicationError(
      `Подтверждение публикации Авито недоступно: ${AVITO_SALE_CAPABILITIES.statusSync}`,
      "VALIDATION",
    );
  }
  if (channelCode === "DOMCLICK") {
    throw new SalePublicationError(
      `Подтверждение публикации Домклик недоступно: ${DOMCLICK_SALE_CAPABILITIES.statusSync}`,
      "VALIDATION",
    );
  }
}

function assertProviderAllowsPrepare(channelCode: string) {
  if (channelCode === "AVITO" && !isSaleProviderFeedReady(AVITO_SALE_CAPABILITIES)) {
    throw new SalePublicationError(
      AVITO_SALE_CAPABILITIES.blockerReason || "Авито sale feed недоступен",
      "VALIDATION",
    );
  }
  if (channelCode === "DOMCLICK" && !isSaleProviderFeedReady(DOMCLICK_SALE_CAPABILITIES)) {
    throw new SalePublicationError(
      DOMCLICK_SALE_CAPABILITIES.blockerReason || "Домклик sale feed недоступен",
      "VALIDATION",
    );
  }
}

export async function applySalePublicationEvent(
  id: string,
  event: PublicationEvent,
  result: ProviderResultInput = {},
) {
  const current = await loadSalePublication(id);

  if (event === "CONFIRM_PUBLISHED" || event === "CONFIRM_UNPUBLISHED") {
    assertProviderAllowsPublishConfirmation(current.salesChannel.code);
  }

  let nextStatus: PublicationStatus;

  try {
    nextStatus = assertPublicationTransition(current.status, event, {
      externalId: current.externalId,
    });
  } catch {
    throw new SalePublicationError("Недопустимый переход статуса публикации", "VALIDATION");
  }

  const now = new Date();
  const failed = nextStatus === "ERROR";
  const succeeded = event === "CONFIRM_PUBLISHED" || event === "CONFIRM_UNPUBLISHED";
  const safeError = failed
    ? redactSecrets(result.error ?? current.lastError ?? "Ошибка публикации")
    : current.lastError;

  return prisma.salePublication.update({
    where: { id },
    data: {
      status: nextStatus,
      lastAttemptAt: now,
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

/**
 * Prepare for future provider send: readiness check + START_PUBLISH → PUBLISHING.
 * Does NOT mark PUBLISHED and does not call providers.
 */
export async function prepareSalePublication(id: string) {
  const publication = await loadSalePublication(id);
  assertProviderAllowsPrepare(publication.salesChannel.code);

  const listing = await getSaleListingById(publication.saleListingId);

  if (!listing) {
    throw new SalePublicationError("Карточка продажи не найдена", "NOT_FOUND");
  }

  const source = toSalePublicationListingSource(listing);
  const normalized = buildNormalizedSalePublicationData(source);
  const readiness = validateSalePublicationReadiness(source, normalized);

  if (!readiness.ready) {
    throw new SalePublicationError(
      readiness.errors.map((item) => item.message).join(". ") || "Карточка не готова к публикации",
      "VALIDATION",
    );
  }

  if (
    publication.status !== "NOT_PUBLISHED" &&
    publication.status !== "UNPUBLISHED" &&
    publication.status !== "ERROR"
  ) {
    throw new SalePublicationError(
      `Подготовка недоступна из статуса ${publication.status}`,
      "VALIDATION",
    );
  }

  const payloadHash = hashNormalizedSalePublicationData(normalized);
  const updated = await applySalePublicationEvent(id, "START_PUBLISH", {
    lastSerializedHash: payloadHash,
  });

  return {
    publication: updated,
    readiness,
    normalized,
    payloadHash,
    prepared: true as const,
    published: false as const,
    providerMappingStatus: SALE_PROVIDER_MAPPING_STATUS,
  };
}

export async function getSaleListingPublicationBundle(saleListingId: string) {
  const listing = await getSaleListingById(saleListingId);
  if (!listing) {
    return null;
  }

  const source = toSalePublicationListingSource(listing);
  const { normalized, readiness } = getSalePublicationReadiness(source);
  const payloadHash = hashNormalizedSalePublicationData(normalized);
  const publications = await getSalePublicationsForListing(saleListingId);

  return {
    listing,
    source,
    normalized,
    readiness,
    payloadHash,
    publications: publications.map((publication) =>
      serializeSalePublication(publication, { currentPayloadHash: payloadHash }),
    ),
  };
}
