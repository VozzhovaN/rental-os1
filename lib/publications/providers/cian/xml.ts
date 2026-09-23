import type { CianFlatRentPayload } from "@/lib/publications/providers/cian/types";
import { CIAN_FEED_VERSION } from "@/lib/publications/providers/cian/types";

export function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error("CIAN XML number must be finite");
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return String(value);
}

function indent(level: number) {
  return "  ".repeat(level);
}

function openTag(name: string, level: number) {
  return `${indent(level)}<${name}>`;
}

function closeTag(name: string, level: number) {
  return `${indent(level)}</${name}>`;
}

function textElement(name: string, value: string, level: number) {
  return `${indent(level)}<${name}>${escapeXml(value)}</${name}>`;
}

function numberElement(name: string, value: number, level: number) {
  return `${indent(level)}<${name}>${formatNumber(value)}</${name}>`;
}

function boolElement(name: string, value: boolean, level: number) {
  return `${indent(level)}<${name}>${value ? "true" : "false"}</${name}>`;
}

/**
 * Serializes one CIAN Object for Category=flatRent.
 * Caller must pass a validated payload (mapToCianFlatRentPayload).
 */
export function serializeCianFlatRentObject(payload: CianFlatRentPayload, level = 1) {
  const lines: string[] = [];
  lines.push(openTag("Object", level));
  lines.push(textElement("Category", payload.category, level + 1));
  lines.push(textElement("ExternalId", payload.externalId, level + 1));
  lines.push(textElement("Description", payload.description, level + 1));
  lines.push(textElement("Address", payload.address, level + 1));
  lines.push(numberElement("FlatRoomsCount", payload.flatRoomsCount, level + 1));
  lines.push(numberElement("TotalArea", payload.totalArea, level + 1));
  lines.push(numberElement("FloorNumber", payload.floorNumber, level + 1));

  lines.push(openTag("Building", level + 1));
  if (payload.buildingFloorsCount != null) {
    lines.push(numberElement("FloorsCount", payload.buildingFloorsCount, level + 2));
  }
  lines.push(closeTag("Building", level + 1));

  lines.push(openTag("BargainTerms", level + 1));
  lines.push(numberElement("Price", payload.price, level + 2));
  lines.push(textElement("Currency", payload.currency, level + 2));
  if (payload.deposit != null) {
    lines.push(numberElement("Deposit", payload.deposit, level + 2));
  }
  lines.push(textElement("LeaseTermType", payload.leaseTermType, level + 2));
  lines.push(closeTag("BargainTerms", level + 1));

  lines.push(openTag("Phones", level + 1));
  for (const phone of payload.phones) {
    lines.push(openTag("PhoneSchema", level + 2));
    lines.push(textElement("CountryCode", phone.countryCode, level + 3));
    lines.push(textElement("Number", phone.number, level + 3));
    lines.push(closeTag("PhoneSchema", level + 2));
  }
  lines.push(closeTag("Phones", level + 1));

  if (payload.photos.length > 0) {
    lines.push(openTag("Photos", level + 1));
    for (const photo of payload.photos) {
      lines.push(openTag("PhotoSchema", level + 2));
      lines.push(textElement("FullUrl", photo.fullUrl, level + 3));
      lines.push(boolElement("IsDefault", photo.isDefault, level + 3));
      lines.push(closeTag("PhotoSchema", level + 2));
    }
    lines.push(closeTag("Photos", level + 1));
  }

  lines.push(closeTag("Object", level));
  return lines.join("\n");
}

/**
 * Complete CIAN feed for already-valid payloads.
 * Does not silently drop invalid items — pass only prepared validItems.
 */
export function serializeCianFeed(payloads: CianFlatRentPayload[]) {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push("<Feed>");
  lines.push(numberElement("Feed_Version", CIAN_FEED_VERSION, 1));
  for (const payload of payloads) {
    lines.push(serializeCianFlatRentObject(payload, 1));
  }
  lines.push("</Feed>");
  lines.push("");
  return lines.join("\n");
}
