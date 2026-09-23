export const ROUTE_ACCESS = {
  PUBLIC: "PUBLIC",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  EXTERNAL_INTEGRATION: "EXTERNAL_INTEGRATION",
} as const;

export type RouteAccess = (typeof ROUTE_ACCESS)[keyof typeof ROUTE_ACCESS];
