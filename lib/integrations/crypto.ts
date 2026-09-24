import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
const MIN_PRODUCTION_KEY_CHARS = 32;

function encryptionMaterial() {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY?.trim();
  if (secret) {
    if (process.env.NODE_ENV === "production" && secret.length < MIN_PRODUCTION_KEY_CHARS) {
      throw new Error(
        `INTEGRATION_ENCRYPTION_KEY must be at least ${MIN_PRODUCTION_KEY_CHARS} characters in production`,
      );
    }
    return secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("INTEGRATION_ENCRYPTION_KEY обязателен в production");
  }
  return "rental-os-local-dev-only-encryption-key";
}

/** AES-256 key material: SHA-256 of configured secret → 32 bytes. */
function keyBytes() {
  return createHash("sha256").update(encryptionMaterial()).digest();
}

export function encryptSecret(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (!value.startsWith(PREFIX)) {
    // Fail closed in production: a value without the versioned prefix means an
    // unencrypted/legacy blob that must never be treated as a valid secret.
    if (process.env.NODE_ENV === "production") {
      return null;
    }
    return value;
  }

  const payload = value.slice(PREFIX.length);
  const [ivPart, tagPart, dataPart] = payload.split(".");

  if (!ivPart || !tagPart || !dataPart) {
    return null;
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", keyBytes(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

export function redactSecrets(value: string) {
  return value
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
    .replace(
      /(access_token|refresh_token|client_secret|CIAN_ACCESS_KEY|access_key|SESSION_SECRET|INTEGRATION_ENCRYPTION_KEY|ADMIN_PASSWORD|passwordHash|password)("?\s*[:=]\s*"?)[^"&\s]+/gi,
      "$1$2[redacted]",
    )
    .replace(/cian[_-]?access[_-]?key["'\s:=]+[^\s"']+/gi, "cian_access_key=[redacted]")
    .replace(/(Cookie|Set-Cookie):\s*[^\n]+/gi, "$1: [redacted]")
    .replace(/rental_os_session=[^;\s]+/gi, "rental_os_session=[redacted]")
    .replace(/avito_oauth_state=[^;\s]+/gi, "avito_oauth_state=[redacted]");
}
