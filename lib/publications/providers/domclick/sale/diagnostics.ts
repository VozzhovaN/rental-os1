import {
  buildNormalizedSalePublicationData,
  type SalePublicationListingSource,
} from "@/lib/publications/normalized-sale";
import { DOMCLICK_SALE_CAPABILITIES } from "@/lib/publications/providers/domclick/sale/capabilities";
import type { PublicationReadinessResult } from "@/lib/publications/readiness";
import { validateSalePublicationReadiness } from "@/lib/publications/sale-readiness";
import { publicationStatusLabels } from "@/lib/publication-labels";
import { getSaleListingById } from "@/lib/sale-listings";
import {
  getSalePublicationsForListing,
  SalePublicationError,
  serializeSalePublication,
  toSalePublicationListingSource,
} from "@/lib/sale-publications";

export type DomclickSaleDiagnosticsView = {
  capabilities: typeof DOMCLICK_SALE_CAPABILITIES;
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
 * Diagnostics for Domclick sale contour. Consumes NormalizedSalePublicationData only.
 * Never invents Domclick XML or LongTerm Publication binding.
 */
export function buildDomclickSaleDiagnostics(
  listing: SalePublicationListingSource,
  publication: ReturnType<typeof serializeSalePublication> | null = null,
): DomclickSaleDiagnosticsView {
  const normalized = buildNormalizedSalePublicationData(listing);
  const baseline = validateSalePublicationReadiness(listing, normalized);
  const soldBlocked = listing.status === "SOLD";

  const messages: string[] = [
    DOMCLICK_SALE_CAPABILITIES.blockerReason!,
    `Feed: ${DOMCLICK_SALE_CAPABILITIES.feed}`,
    `Status sync: ${DOMCLICK_SALE_CAPABILITIES.statusSync}`,
    `Unpublish: ${DOMCLICK_SALE_CAPABILITIES.unpublish}`,
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
    capabilities: DOMCLICK_SALE_CAPABILITIES,
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

export async function getDomclickSalePublicationDiagnostics(saleListingId: string) {
  const listing = await getSaleListingById(saleListingId);
  if (!listing) {
    throw new SalePublicationError("Карточка продажи не найдена", "NOT_FOUND");
  }

  const publications = await getSalePublicationsForListing(saleListingId);
  const publication =
    publications.find((item) => item.salesChannel.code === "DOMCLICK") ?? null;

  return buildDomclickSaleDiagnostics(
    toSalePublicationListingSource(listing),
    publication ? serializeSalePublication(publication) : null,
  );
}
