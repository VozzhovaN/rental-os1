import { createHash } from "node:crypto";
import {
  buildNormalizedLongTermPublicationData,
  hashNormalizedLongTermPublicationData,
  type NormalizedLongTermPublicationData,
  type PublicationListingSource,
} from "@/lib/publications/normalized-long-term";
import {
  mapToCianFlatRentPayload,
  prepareCianFeedItems,
} from "@/lib/publications/providers/cian/mapping";
import type {
  CianFlatRentPayload,
  CianIssue,
} from "@/lib/publications/providers/cian/types";
import { validateCianFlatRentPublication } from "@/lib/publications/providers/cian/validation";
import { serializeCianFeed } from "@/lib/publications/providers/cian/xml";
import {
  validateLongTermPublicationReadiness,
  type PublicationReadinessResult,
} from "@/lib/publications/readiness";

export type CianListingPreviewResult =
  | {
      ready: true;
      listingId: string;
      baseline: PublicationReadinessResult;
      cian: { valid: true; errors: []; warnings: CianIssue[] };
      normalized: NormalizedLongTermPublicationData;
      payload: CianFlatRentPayload;
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
      normalized: NormalizedLongTermPublicationData;
      payload: null;
      xml: null;
      normalizedHash: string;
      cianPayloadHash: null;
      fileName: string;
      errors: CianIssue[];
      warnings: CianIssue[];
    };

export type CianFeedPreviewResult = {
  validItems: CianFlatRentPayload[];
  invalidItems: Array<{
    listingId: string;
    errors: CianIssue[];
    warnings: CianIssue[];
  }>;
  warnings: CianIssue[];
  xml: string;
};

function canonicalizeCianFlatRentPayload(payload: CianFlatRentPayload) {
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
    leaseTermType: payload.leaseTermType,
    deposit: payload.deposit,
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

/** SHA-256 of canonical CIAN payload. Not persisted. */
export function hashCianFlatRentPayload(payload: CianFlatRentPayload) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalizeCianFlatRentPayload(payload)))
    .digest("hex");
}

export function cianPreviewFileName(listingId: string) {
  return `cian-${listingId}.xml`;
}

/**
 * Full local CIAN preview for one listing.
 * No DB writes, no network, no Publication mutation.
 */
export function buildCianListingPreview(listing: PublicationListingSource): CianListingPreviewResult {
  const normalized = buildNormalizedLongTermPublicationData(listing);
  const baseline = validateLongTermPublicationReadiness(listing, normalized);
  const cian = validateCianFlatRentPublication(normalized);
  const normalizedHash = hashNormalizedLongTermPublicationData(normalized);
  const fileName = cianPreviewFileName(listing.id);

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

  const payload = mapToCianFlatRentPayload(normalized);
  const xml = serializeCianFeed([payload]);

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
    cianPayloadHash: hashCianFlatRentPayload(payload),
    fileName,
  };
}

/**
 * Multi-listing CIAN feed preparation with isolation.
 * Invalid items do not block valid ones. No public URL.
 */
export function prepareCianFeed(listings: PublicationListingSource[]): CianFeedPreviewResult {
  const normalizedItems = listings.map((listing) => {
    const normalized = buildNormalizedLongTermPublicationData(listing);
    const baseline = validateLongTermPublicationReadiness(listing, normalized);
    return { listing, normalized, baseline };
  });

  const eligible: NormalizedLongTermPublicationData[] = [];
  const invalidFromBaseline: CianFeedPreviewResult["invalidItems"] = [];

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

  const prepared = prepareCianFeedItems(eligible);
  const invalidItems = [...invalidFromBaseline, ...prepared.invalidItems];
  const xml = serializeCianFeed(prepared.validItems);

  return {
    validItems: prepared.validItems,
    invalidItems,
    warnings: prepared.warnings,
    xml,
  };
}
