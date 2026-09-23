/**
 * Explicit inventory of every app/api/ (all route.ts files) file.
 * Adding a new route file without registering it here fails the classification test.
 * Ambiguous routes default to AUTH_REQUIRED.
 */

import { ROUTE_ACCESS, type RouteAccess } from "@/lib/auth/route-access-types";

export type RegisteredApiRoute = {
  /** Path relative to app/api/, e.g. "properties/[id]/route.ts" */
  routeFile: string;
  /** URL pattern with [param] segments, e.g. "/api/properties/[id]" */
  pathPattern: string;
  access: RouteAccess | "AUTH_OPTIONAL";
};

export const API_ROUTE_REGISTRY: readonly RegisteredApiRoute[] = [
  { routeFile: "auth/login/route.ts", pathPattern: "/api/auth/login", access: ROUTE_ACCESS.PUBLIC },
  { routeFile: "auth/logout/route.ts", pathPattern: "/api/auth/logout", access: "AUTH_OPTIONAL" },
  { routeFile: "auth/me/route.ts", pathPattern: "/api/auth/me", access: ROUTE_ACCESS.AUTH_REQUIRED },

  { routeFile: "feeds/cian/long-term.xml/route.ts", pathPattern: "/api/feeds/cian/long-term.xml", access: ROUTE_ACCESS.PUBLIC },
  { routeFile: "feeds/cian/sale.xml/route.ts", pathPattern: "/api/feeds/cian/sale.xml", access: ROUTE_ACCESS.PUBLIC },

  {
    routeFile: "integrations/avito/callback/route.ts",
    pathPattern: "/api/integrations/avito/callback",
    access: ROUTE_ACCESS.EXTERNAL_INTEGRATION,
  },

  { routeFile: "bookings/route.ts", pathPattern: "/api/bookings", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "bookings/[id]/route.ts", pathPattern: "/api/bookings/[id]", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "bookings/[id]/check-in/route.ts", pathPattern: "/api/bookings/[id]/check-in", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "bookings/[id]/check-out/route.ts", pathPattern: "/api/bookings/[id]/check-out", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "bookings/[id]/finance/route.ts", pathPattern: "/api/bookings/[id]/finance", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "bookings/[id]/commission/route.ts", pathPattern: "/api/bookings/[id]/commission", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "bookings/[id]/payments/route.ts", pathPattern: "/api/bookings/[id]/payments", access: ROUTE_ACCESS.AUTH_REQUIRED },
  {
    routeFile: "bookings/[id]/payments/[paymentId]/refund/route.ts",
    pathPattern: "/api/bookings/[id]/payments/[paymentId]/refund",
    access: ROUTE_ACCESS.AUTH_REQUIRED,
  },

  { routeFile: "buyers/route.ts", pathPattern: "/api/buyers", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "buyers/[id]/route.ts", pathPattern: "/api/buyers/[id]", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "buyers/[id]/history/route.ts", pathPattern: "/api/buyers/[id]/history", access: ROUTE_ACCESS.AUTH_REQUIRED },

  { routeFile: "buyer-interests/route.ts", pathPattern: "/api/buyer-interests", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "buyer-interests/[id]/route.ts", pathPattern: "/api/buyer-interests/[id]", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "buyer-interests/[id]/deposits/route.ts", pathPattern: "/api/buyer-interests/[id]/deposits", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "buyer-interests/[id]/purchase/route.ts", pathPattern: "/api/buyer-interests/[id]/purchase", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "buyer-interests/[id]/viewings/route.ts", pathPattern: "/api/buyer-interests/[id]/viewings", access: ROUTE_ACCESS.AUTH_REQUIRED },

  { routeFile: "crm/cian-feed-preview/route.ts", pathPattern: "/api/crm/cian-feed-preview", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "dashboard/route.ts", pathPattern: "/api/dashboard", access: ROUTE_ACCESS.AUTH_REQUIRED },
  {
    routeFile: "dashboard/today-events/route.ts",
    pathPattern: "/api/dashboard/today-events",
    access: ROUTE_ACCESS.AUTH_REQUIRED,
  },
  {
    routeFile: "dashboard/sales-calendar/route.ts",
    pathPattern: "/api/dashboard/sales-calendar",
    access: ROUTE_ACCESS.AUTH_REQUIRED,
  },

  { routeFile: "finance/transactions/route.ts", pathPattern: "/api/finance/transactions", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "finance/expenses/route.ts", pathPattern: "/api/finance/expenses", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "finance/adjustments/route.ts", pathPattern: "/api/finance/adjustments", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "finance/summary/route.ts", pathPattern: "/api/finance/summary", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "finance/dashboard/route.ts", pathPattern: "/api/finance/dashboard", access: ROUTE_ACCESS.AUTH_REQUIRED },
  {
    routeFile: "finance/dashboard/drilldown/route.ts",
    pathPattern: "/api/finance/dashboard/drilldown",
    access: ROUTE_ACCESS.AUTH_REQUIRED,
  },

  { routeFile: "commission-payments/route.ts", pathPattern: "/api/commission-payments", access: ROUTE_ACCESS.AUTH_REQUIRED },

  { routeFile: "owners/route.ts", pathPattern: "/api/owners", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "owners/[id]/route.ts", pathPattern: "/api/owners/[id]", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "owners/[id]/finance/route.ts", pathPattern: "/api/owners/[id]/finance", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "owners/[id]/payouts/route.ts", pathPattern: "/api/owners/[id]/payouts", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "owners/[id]/settlements/route.ts", pathPattern: "/api/owners/[id]/settlements", access: ROUTE_ACCESS.AUTH_REQUIRED },
  {
    routeFile: "owner-settlements/[id]/close/route.ts",
    pathPattern: "/api/owner-settlements/[id]/close",
    access: ROUTE_ACCESS.AUTH_REQUIRED,
  },

  { routeFile: "deposits/[id]/route.ts", pathPattern: "/api/deposits/[id]", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "deposits/[id]/forfeit/route.ts", pathPattern: "/api/deposits/[id]/forfeit", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "deposits/[id]/pay/route.ts", pathPattern: "/api/deposits/[id]/pay", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "deposits/[id]/refund/route.ts", pathPattern: "/api/deposits/[id]/refund", access: ROUTE_ACCESS.AUTH_REQUIRED },

  { routeFile: "guests/route.ts", pathPattern: "/api/guests", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "guests/[id]/route.ts", pathPattern: "/api/guests/[id]", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "guests/[id]/bookings/route.ts", pathPattern: "/api/guests/[id]/bookings", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "guests/[id]/history/route.ts", pathPattern: "/api/guests/[id]/history", access: ROUTE_ACCESS.AUTH_REQUIRED },

  { routeFile: "integrations/route.ts", pathPattern: "/api/integrations", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "integrations/logs/route.ts", pathPattern: "/api/integrations/logs", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "integrations/avito/route.ts", pathPattern: "/api/integrations/avito", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "integrations/avito/connect/route.ts", pathPattern: "/api/integrations/avito/connect", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "integrations/avito/disconnect/route.ts", pathPattern: "/api/integrations/avito/disconnect", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "integrations/avito/listings/route.ts", pathPattern: "/api/integrations/avito/listings", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "integrations/avito/listings/sync/route.ts", pathPattern: "/api/integrations/avito/listings/sync", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "integrations/avito/sync/route.ts", pathPattern: "/api/integrations/avito/sync", access: ROUTE_ACCESS.AUTH_REQUIRED },

  { routeFile: "long-term-listings/route.ts", pathPattern: "/api/long-term-listings", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "long-term-listings/[id]/route.ts", pathPattern: "/api/long-term-listings/[id]", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "long-term-listings/[id]/photos/route.ts", pathPattern: "/api/long-term-listings/[id]/photos", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "long-term-listings/[id]/publications/route.ts", pathPattern: "/api/long-term-listings/[id]/publications", access: ROUTE_ACCESS.AUTH_REQUIRED },
  {
    routeFile: "long-term-listings/[id]/publications/[publicationId]/route.ts",
    pathPattern: "/api/long-term-listings/[id]/publications/[publicationId]",
    access: ROUTE_ACCESS.AUTH_REQUIRED,
  },
  {
    routeFile: "long-term-listings/[id]/publications/cian/prepare/route.ts",
    pathPattern: "/api/long-term-listings/[id]/publications/cian/prepare",
    access: ROUTE_ACCESS.AUTH_REQUIRED,
  },
  {
    routeFile: "long-term-listings/[id]/publications/cian/preview/route.ts",
    pathPattern: "/api/long-term-listings/[id]/publications/cian/preview",
    access: ROUTE_ACCESS.AUTH_REQUIRED,
  },

  { routeFile: "long-term-contracts/route.ts", pathPattern: "/api/long-term-contracts", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "long-term-contracts/[id]/route.ts", pathPattern: "/api/long-term-contracts/[id]", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "long-term-contracts/[id]/activate/route.ts", pathPattern: "/api/long-term-contracts/[id]/activate", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "long-term-contracts/[id]/end/route.ts", pathPattern: "/api/long-term-contracts/[id]/end", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "long-term-contracts/[id]/cancel/route.ts", pathPattern: "/api/long-term-contracts/[id]/cancel", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "long-term-contracts/[id]/charges/route.ts", pathPattern: "/api/long-term-contracts/[id]/charges", access: ROUTE_ACCESS.AUTH_REQUIRED },
  {
    routeFile: "long-term-contracts/[id]/charges/generate/route.ts",
    pathPattern: "/api/long-term-contracts/[id]/charges/generate",
    access: ROUTE_ACCESS.AUTH_REQUIRED,
  },
  { routeFile: "long-term-contracts/[id]/payments/route.ts", pathPattern: "/api/long-term-contracts/[id]/payments", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "long-term-contracts/[id]/finance/route.ts", pathPattern: "/api/long-term-contracts/[id]/finance", access: ROUTE_ACCESS.AUTH_REQUIRED },
  {
    routeFile: "long-term-contracts/[id]/commission/route.ts",
    pathPattern: "/api/long-term-contracts/[id]/commission",
    access: ROUTE_ACCESS.AUTH_REQUIRED,
  },

  { routeFile: "properties/route.ts", pathPattern: "/api/properties", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "properties/[id]/route.ts", pathPattern: "/api/properties/[id]", access: ROUTE_ACCESS.AUTH_REQUIRED },
  {
    routeFile: "properties/[id]/economics/route.ts",
    pathPattern: "/api/properties/[id]/economics",
    access: ROUTE_ACCESS.AUTH_REQUIRED,
  },
  { routeFile: "properties/[id]/photos/route.ts", pathPattern: "/api/properties/[id]/photos", access: ROUTE_ACCESS.AUTH_REQUIRED },
  {
    routeFile: "properties/[id]/photos/reorder/route.ts",
    pathPattern: "/api/properties/[id]/photos/reorder",
    access: ROUTE_ACCESS.AUTH_REQUIRED,
  },
  {
    routeFile: "properties/[id]/photos/[photoId]/route.ts",
    pathPattern: "/api/properties/[id]/photos/[photoId]",
    access: ROUTE_ACCESS.AUTH_REQUIRED,
  },
  {
    routeFile: "properties/[id]/photos/[photoId]/file/route.ts",
    pathPattern: "/api/properties/[id]/photos/[photoId]/file",
    access: ROUTE_ACCESS.AUTH_REQUIRED,
  },
  { routeFile: "properties/[id]/channels/route.ts", pathPattern: "/api/properties/[id]/channels", access: ROUTE_ACCESS.AUTH_REQUIRED },
  {
    routeFile: "properties/[id]/channels/[listingId]/route.ts",
    pathPattern: "/api/properties/[id]/channels/[listingId]",
    access: ROUTE_ACCESS.AUTH_REQUIRED,
  },
  {
    routeFile: "properties/[id]/channels/[listingId]/sync/route.ts",
    pathPattern: "/api/properties/[id]/channels/[listingId]/sync",
    access: ROUTE_ACCESS.AUTH_REQUIRED,
  },

  { routeFile: "sale-listings/route.ts", pathPattern: "/api/sale-listings", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "sale-listings/[id]/route.ts", pathPattern: "/api/sale-listings/[id]", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "sale-listings/[id]/photos/route.ts", pathPattern: "/api/sale-listings/[id]/photos", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "sale-listings/[id]/publications/route.ts", pathPattern: "/api/sale-listings/[id]/publications", access: ROUTE_ACCESS.AUTH_REQUIRED },
  {
    routeFile: "sale-listings/[id]/publications/cian/prepare/route.ts",
    pathPattern: "/api/sale-listings/[id]/publications/cian/prepare",
    access: ROUTE_ACCESS.AUTH_REQUIRED,
  },
  {
    routeFile: "sale-listings/[id]/publications/cian/preview/route.ts",
    pathPattern: "/api/sale-listings/[id]/publications/cian/preview",
    access: ROUTE_ACCESS.AUTH_REQUIRED,
  },

  { routeFile: "sale-publications/[id]/route.ts", pathPattern: "/api/sale-publications/[id]", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "sale-publications/[id]/prepare/route.ts", pathPattern: "/api/sale-publications/[id]/prepare", access: ROUTE_ACCESS.AUTH_REQUIRED },

  { routeFile: "sales-channels/route.ts", pathPattern: "/api/sales-channels", access: ROUTE_ACCESS.AUTH_REQUIRED },

  { routeFile: "viewings/[id]/route.ts", pathPattern: "/api/viewings/[id]", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "viewings/[id]/cancel/route.ts", pathPattern: "/api/viewings/[id]/cancel", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "viewings/[id]/complete/route.ts", pathPattern: "/api/viewings/[id]/complete", access: ROUTE_ACCESS.AUTH_REQUIRED },
  { routeFile: "viewings/[id]/no-show/route.ts", pathPattern: "/api/viewings/[id]/no-show", access: ROUTE_ACCESS.AUTH_REQUIRED },
] as const;

export const EXTERNAL_CALLBACK_AUTH = "BLOCKED_BY_PROVIDER_CONFIRMATION" as const;

export function listRegistryByAccess(access: RegisteredApiRoute["access"]) {
  return API_ROUTE_REGISTRY.filter((r) => r.access === access);
}
