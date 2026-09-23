import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Session, User } from "@prisma/client";
import { getSessionPepper } from "@/lib/auth/env";
import { getSessionTtlMs, SESSION_TOKEN_BYTES, LAST_USED_TOUCH_INTERVAL_MS } from "@/lib/auth/constants";
import { prisma } from "@/lib/prisma";

export type SessionUser = Pick<User, "id" | "email" | "name" | "isActive">;

export type ValidSession = {
  session: Session;
  user: SessionUser;
  rawToken: string;
};

export function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
}

export function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(`${getSessionPepper()}:${rawToken}`).digest("hex");
}

function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${getSessionPepper()}:ip:${ip}`).digest("hex");
}

/**
 * Lazy expired-session cleanup. Safe to call during login/session create.
 * Does not block on large deletes beyond a single deleteMany.
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

export async function createSession(input: {
  userId: string;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<{ rawToken: string; session: Session }> {
  // Best-effort cleanup; never fails session creation
  await cleanupExpiredSessions().catch(() => 0);

  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + getSessionTtlMs());

  const session = await prisma.session.create({
    data: {
      userId: input.userId,
      tokenHash,
      expiresAt,
      userAgent: input.userAgent?.slice(0, 512) || null,
      ipHash: hashIp(input.ip),
      lastUsedAt: new Date(),
    },
  });

  return { rawToken, session };
}

function shouldTouchLastUsed(lastUsedAt: Date | null): boolean {
  if (!lastUsedAt) return true;
  return Date.now() - lastUsedAt.getTime() >= LAST_USED_TOUCH_INTERVAL_MS;
}

export async function getSessionByRawToken(rawToken: string | null | undefined): Promise<ValidSession | null> {
  if (!rawToken || rawToken.length < 16) {
    return null;
  }

  const tokenHash = hashSessionToken(rawToken);
  const row = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: { id: true, email: true, name: true, isActive: true },
      },
    },
  });

  if (!row) {
    return null;
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: row.id } }).catch(() => undefined);
    return null;
  }

  if (!row.user.isActive) {
    return null;
  }

  if (shouldTouchLastUsed(row.lastUsedAt)) {
    // Fire-and-forget throttle; do not await in hot path beyond starting the promise
    void prisma.session
      .update({
        where: { id: row.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => undefined);
  }

  return {
    session: row,
    user: row.user,
    rawToken,
  };
}

export async function revokeSessionByRawToken(rawToken: string | null | undefined): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashSessionToken(rawToken);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

export async function revokeAllUserSessions(userId: string): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { userId } });
  return result.count;
}

export function safeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
