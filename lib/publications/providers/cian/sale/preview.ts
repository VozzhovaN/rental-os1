import { createHash } from "node:crypto";
import {
  buildNormalizedSalePublicationData,
  hashNormalizedSalePublicationData,
  type NormalizedSalePublicationData,
  type SalePublicationListingSource,
} from "@/lib/publications/normalized-sale";
import type { PublicationReadinessResult } from "@/lib/publications/readiness";
import {
  mapToCianSalePayload,
  prepareCianSaleFeedItems,
} from "@/lib/publications/providers/cian/sale/mapping";
import type { CianIssue } from "@/lib/publications/providers/cian/types";
import type { CianSalePayload } from "@/lib/publications/providers/cian/sale/types";
import { validateCianSalePublication } from "@/lib/publications/providers/cian/sale/validation";
import { serializeCianSaleFeed } from "@/lib/publications/providers/cian/sale/xml";
import { validateSalePublicationReadiness } from "@/lib/publications/sale-readiness";

export type CianSaleListingPreviewResult =
  | {
      ready: true;
      listingId: string;
      baseline: PublicationReadinessResult;
      cian: { valid: true; errors: []; warnings: CianIssue[] };
      normalized: NormalizedSalePublicationData;
      payload: CianSalePayload;
      xml: string;
      normalizedHash: string;
      cianPayloadHash: string;
      fileName: string;
    }
  | {
      ready: false;
      listingId: string;
      baseline: PublicationReadinessResult;
      cian: { valid: boolean; errors: CianIssue[]; warnings: CianIssue[] };
      normalized: NormalizedSalePublicationData;
      payload: null;
      xml: null;
      normalizedHash: string;
      cianPayloadHash: null;
      fileName: string;
      errors: CianIssue[];
      warnings: CianIssue[];
    };

export type CianSaleFeedPreviewResult = {
  validItems: CianSalePayload[];
  invalidItems: Array<{
    listingId: string;
    errors: CianIssue[];
    warnings: CianIssue[];
  }>;
  warnings: CianIssue[];
  xml: string;
};

function canonicalizeCianSalePayload(payload: CianSalePayload) {
  return {
    externalId: payload.externalId,
    category: payload.category,
    description: payload.description,
    address: payload.address,
    flatRoomsCount: payload.flatRoomsCount,
    totalArea: payload.totalArea,
    floorNumber: payload.floorNumber,
    buildingFloorsCount: payload.buildingFloorsCount,
    price: payload.price,
    currency: payload.currency,
    phones: payload.phones.map((phone) => ({
      countryCode: phone.countryCode,
      number: phone.number,
    })),
    photos: payload.photos.map((photo) => ({
      fullUrl: photo.fullUrl,
      isDefault: photo.isDefault,
    })),
  };
}

export function hashCianSalePayload(payload: CianSalePayload) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalizeCianSalePayload(payload)))
    .digest("hex");
}

export function cianSalePreviewFileName(saleListingId: string) {
  return `cian-sale-${saleListingId}.xml`;
}

/**
 * Local CIAN sale preview. No DB writes, no Publication mutation.
 */
export function buildCianSaleListingPreview(
  listing: SalePublicationListingSource,
): CianSaleListingPreviewResult {
  const normalized = buildNormalizedSalePublicationData(listing);
  const baseline = validateSalePublicationReadiness(listing, normalized);
  const cian = validateCianSalePublication(normalized);
  const normalizedHash = hashNormalizedSalePublicationData(normalized);
  const fileName = cianSalePreviewFileName(listing.id);

  const baselineErrorsAsCian: CianIssue[] = baseline.errors.map((item) => ({
    code: `BASELINE_${item.code}`,
    field: item.field,
    message: item.message,
  }));
  const errors = [...baselineErrorsAsCian, ...cian.errors];
  const warnings = [
    ...baseline.warnings.map((item) => ({
      code: `BASELINE_${item.code}`,
      field: item.field,
      message: item.message,
    })),
    ...cian.warnings,
  ];

  if (!baseline.ready || !cian.valid) {
    return {
      ready: false,
      listingId: listing.id,
      baseline,
      cian: {
        valid: cian.valid,
        errors: cian.errors,
        warnings: cian.warnings,
      },
      normalized,
      payload: null,
      xml: null,
      normalizedHash,
      cianPayloadHash: null,
      fileName,
      errors,
      warnings,
    };
  }

  const payload = mapToCianSalePayload(normalized);
  const xml = serializeCianSaleFeed([payload]);

  return {
    ready: true,
    listingId: listing.id,
    baseline,
    cian: {
      valid: true,
      errors: [],
      warnings: cian.warnings,
    },
    normalized,
    payload,
    xml,
    normalizedHash,
    cianPayloadHash: hashCianSalePayload(payload),
    fileName,
  };
}

export function prepareCianSaleFeed(
  listings: SalePublicationListingSource[],
): CianSaleFeedPreviewResult {
  const normalizedItems = listings.map((listing) => {
    const normalized = buildNormalizedSalePublicationData(listing);
    const baseline = validateSalePublicationReadiness(listing, normalized);
    return { listing, normalized, baseline };
  });

  const eligible: NormalizedSalePublicationData[] = [];
  const invalidFromBaseline: CianSaleFeedPreviewResult["invalidItems"] = [];

  for (const item of normalizedItems) {
    if (!item.baseline.ready) {
      invalidFromBaseline.push({
        listingId: item.listing.id,
        errors: item.baseline.errors.map((error) => ({
          code: `BASELINE_${error.code}`,
          field: error.field,
          message: error.message,
        })),
        warnings: item.baseline.warnings.map((warning) => ({
          code: `BASELINE_${warning.code}`,
          field: warning.field,
          message: warning.message,
        })),
      });
      continue;
    }
    eligible.push(item.normalized);
  }

  const prepared = prepareCianSaleFeedItems(eligible);
  const invalidItems = [...invalidFromBaseline, ...prepared.invalidItems];
  const xml = serializeCianSaleFeed(prepared.validItems);

  return {
    validItems: prepared.validItems,
    invalidItems,
    warnings: prepared.warnings,
    xml,
  };
}
