import argon2 from "argon2";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/constants";

/**
 * Password hashing: Argon2id (OWASP-recommended).
 * Never store or log plaintext passwords.
 */
export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  if (typeof password !== "string" || password.length === 0) {
    return false;
  }
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
