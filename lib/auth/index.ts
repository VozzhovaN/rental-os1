export { SESSION_COOKIE_NAME, DEFAULT_SESSION_TTL_DAYS, MIN_PASSWORD_LENGTH, MULTI_INSTANCE_RATE_LIMIT } from "@/lib/auth/constants";
export { hashPassword, verifyPassword, normalizeEmail } from "@/lib/auth/password";
export {
  createSession,
  getSessionByRawToken,
  revokeSessionByRawToken,
  revokeAllUserSessions,
  hashSessionToken,
  generateSessionToken,
  cleanupExpiredSessions,
} from "@/lib/auth/session";
export {
  requireAuth,
  authenticateRequest,
  getCurrentUserFromCookies,
  getValidSessionFromCookies,
  enforceApiAccess,
} from "@/lib/auth/require-auth";
export { withApiAuth, requireApiAuth } from "@/lib/auth/with-api-auth";
export { classifyApiPath, ROUTE_ACCESS } from "@/lib/auth/route-access";
export { API_ROUTE_REGISTRY, EXTERNAL_CALLBACK_AUTH } from "@/lib/auth/api-registry";
export { bootstrapAdminUser } from "@/lib/auth/bootstrap";
export { getAppOrigin } from "@/lib/auth/env";
