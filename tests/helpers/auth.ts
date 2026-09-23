import { hashPassword, normalizeEmail } from "@/lib/auth/password";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function createTestUser(overrides?: {
  email?: string;
  password?: string;
  isActive?: boolean;
  name?: string | null;
}) {
  const password = overrides?.password ?? "correct-horse-battery-staple";
  const email = normalizeEmail(
    overrides?.email ?? `user-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
  );
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      name: overrides?.name ?? "Test User",
      isActive: overrides?.isActive ?? true,
    },
  });
  return { user, password, email };
}

export async function createTestSessionCookie(userId?: string) {
  const resolvedUserId =
    userId ??
    (
      await createTestUser()
    ).user.id;
  const { rawToken, session } = await createSession({ userId: resolvedUserId });
  return {
    rawToken,
    session,
    userId: resolvedUserId,
    cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
  };
}

export function authedHeaders(cookie: string, extra?: HeadersInit): HeadersInit {
  return {
    cookie,
    origin: "http://localhost",
    host: "localhost",
    ...extra,
  };
}

export function authedRequest(url: string, cookie: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("cookie", cookie);
  if (!headers.has("origin") && init?.method && init.method !== "GET" && init.method !== "HEAD") {
    headers.set("origin", "http://localhost");
  }
  if (!headers.has("host")) {
    headers.set("host", "localhost");
  }
  return new Request(url, { ...init, headers });
}
