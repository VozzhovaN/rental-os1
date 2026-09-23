/**
 * Auth-related environment validation.
 * Never expose these via NEXT_PUBLIC_*.
 * Never log secret values.
 */

export function getSessionPepper(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret && secret.length >= 32) {
    return secret;
  }
  if (secret && secret.length >= 16 && process.env.NODE_ENV !== "production") {
    return secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET (min 32 chars) is required in production");
  }
  return "rental-os-local-dev-session-pepper";
}

/**
 * Canonical app origin for CSRF (scheme + host), e.g. https://crm.example.com
 * Required in production. Optional in development (falls back to Host matching).
 */
export function getAppOrigin(): string | null {
  const raw = process.env.APP_ORIGIN?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("APP_ORIGIN is required in production (e.g. https://crm.example.com)");
    }
    return null;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("APP_ORIGIN must be a valid absolute URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("APP_ORIGIN must use http or https");
  }
  return url.origin;
}

export type AdminBootstrapEnv = {
  email: string;
  password: string;
};

export function readAdminBootstrapEnv(): AdminBootstrapEnv | null {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || password === undefined || password === "") {
    return null;
  }
  return { email, password };
}

export function assertAdminPasswordPolicy(password: string) {
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters");
  }
}
