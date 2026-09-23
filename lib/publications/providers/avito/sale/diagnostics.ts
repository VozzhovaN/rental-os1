import {
  buildNormalizedSalePublicationData,
  type SalePublicationListingSource,
} from "@/lib/publications/normalized-sale";
import { AVITO_SALE_CAPABILITIES } from "@/lib/publications/providers/avito/sale/capabilities";
import type { PublicationReadinessResult } from "@/lib/publications/readiness";
import { validateSalePublicationReadiness } from "@/lib/publications/sale-readiness";
import { getSaleListingById } from "@/lib/sale-listings";
import {
  getSalePublicationsForListing,
  SalePublicationError,
  serializeSalePublication,
  toSalePublicationListingSource,
} from "@/lib/sale-publications";
import { publicationStatusLabels } from "@/lib/publication-labels";

export type AvitoSaleDiagnosticsView = {
  capabilities: typeof AVITO_SALE_CAPABILITIES;
  baseline: PublicationReadinessResult;
  providerReady: false;
  serializerImplemented: false;
  usesChannelListing: false;
  usesLongTermPublication: false;
  publication: ReturnType<typeof serializeSalePublication> | null;
  includedInFeed: false;
  statusLabel: string;
  soldBlocked: boolean;
  canPrepare: false;
  canPreviewXml: false;
  canConfirmPublished: false;
  messages: string[];
};

/**
 * Diagnostics for Avito sale contour. Consumes NormalizedSalePublicationData only.
 * Never invents Autoload XML or ChannelListing binding.
 */
export function buildAvitoSaleDiagnostics(
  listing: SalePublicationListingSource,
  publication: ReturnType<typeof serializeSalePublication> | null = null,
): AvitoSaleDiagnosticsView {
  const normalized = buildNormalizedSalePublicationData(listing);
  const baseline = validateSalePublicationReadiness(listing, normalized);
  const soldBlocked = listing.status === "SOLD";

  const messages: string[] = [
    AVITO_SALE_CAPABILITIES.blockerReason!,
    `Feed: ${AVITO_SALE_CAPABILITIES.feed}`,
    `Status sync: ${AVITO_SALE_CAPABILITIES.statusSync}`,
    `Unpublish: ${AVITO_SALE_CAPABILITIES.unpublish}`,
  ];

  if (soldBlocked) {
    messages.unshift(
      "Объект продан — требуется снятие публикации на стороне провайдера",
    );
  }

  if (!["APARTMENT", "STUDIO"].includes(listing.property.type)) {
    messages.push("v1 scope: только APARTMENT/STUDIO secondary sale");
  }

  return {
    capabilities: AVITO_SALE_CAPABILITIES,
    baseline,
    providerReady: false,
    serializerImplemented: false,
    usesChannelListing: false,
    usesLongTermPublication: false,
    publication,
    includedInFeed: false,
    statusLabel: publication
      ? publicationStatusLabels[publication.status]
      : "Нет SalePublication",
    soldBlocked,
    canPrepare: false,
    canPreviewXml: false,
    canConfirmPublished: false,
    messages,
  };
}

export async function getAvitoSalePublicationDiagnostics(saleListingId: string) {
  const listing = await getSaleListingById(saleListingId);
  if (!listing) {
    throw new SalePublicationError("Карточка продажи не найдена", "NOT_FOUND");
  }

  const publications = await getSalePublicationsForListing(saleListingId);
  const publication =
    publications.find((item) => item.salesChannel.code === "AVITO") ?? null;

  return buildAvitoSaleDiagnostics(
    toSalePublicationListingSource(listing),
    publication
      ? serializeSalePublication(publication)
      : null,
  );
}
