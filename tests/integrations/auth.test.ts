import "./helpers-preload";
import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import { GET as getMe } from "@/app/api/auth/me/route";
import { POST as postLogin } from "@/app/api/auth/login/route";
import { POST as postLogout } from "@/app/api/auth/logout/route";
import { GET as getCianLongTermFeed } from "@/app/api/feeds/cian/long-term.xml/route";
import { GET as getCianSaleFeed } from "@/app/api/feeds/cian/sale.xml/route";
import { bootstrapAdminUser } from "@/lib/auth/bootstrap";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { sessionCookieOptions } from "@/lib/auth/cookies";
import { assertTrustedOrigin } from "@/lib/auth/csrf";
import { hashPassword, normalizeEmail, verifyPassword } from "@/lib/auth/password";
import {
  checkLoginRateLimit,
  clearLoginFailures,
  recordLoginFailure,
  resetLoginRateLimitForTests,
} from "@/lib/auth/rate-limit";
import { requireAuth } from "@/lib/auth/require-auth";
import { classifyApiPath, ROUTE_ACCESS } from "@/lib/auth/route-access";
import {
  createSession,
  getSessionByRawToken,
  hashSessionToken,
  revokeSessionByRawToken,
} from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { prepareTestDatabase } from "../helpers/db";

function cookieHeader(rawToken: string) {
  return `${SESSION_COOKIE_NAME}=${rawToken}`;
}

async function createUser(overrides?: {
  email?: string;
  password?: string;
  isActive?: boolean;
  name?: string | null;
}) {
  const password = overrides?.password ?? "correct-horse-battery-staple";
  const email = normalizeEmail(overrides?.email ?? `user-${Date.now()}-${Math.random()}@example.com`);
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

describe("auth foundation", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  afterEach(async () => {
    resetLoginRateLimitForTests();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
  });

  it("password stored hashed; valid verifies; invalid rejected", async () => {
    const password = "correct-horse-battery-staple";
    const hash = await hashPassword(password);
    assert.notEqual(hash, password);
    assert.equal(hash.includes(password), false);
    assert.equal(await verifyPassword(hash, password), true);
    assert.equal(await verifyPassword(hash, "wrong-password-xx"), false);
  });

  it("duplicate email blocked; email normalized", async () => {
    await createUser({ email: "Admin@Example.COM" });
    assert.equal(normalizeEmail("  Admin@Example.COM "), "admin@example.com");
    const hash = await hashPassword("another-password-12");
    await assert.rejects(() =>
      prisma.user.create({
        data: {
          email: "admin@example.com",
          passwordHash: hash,
        },
      }),
    );
  });

  it("inactive user cannot login; invalid login generic 401", async () => {
    const active = await createUser({ email: "active@example.com" });
    await createUser({ email: "inactive@example.com", isActive: false, password: "inactive-password-12" });

    const bad = await postLogin(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nobody@example.com", password: "x".repeat(12) }),
      }),
    );
    assert.equal(bad.status, 401);
    const badBody = await bad.json();
    assert.equal(badBody.error, "Неверный email или пароль");

    const inactive = await postLogin(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "inactive@example.com", password: "inactive-password-12" }),
      }),
    );
    assert.equal(inactive.status, 401);

    const ok = await postLogin(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: active.email, password: active.password }),
      }),
    );
    assert.equal(ok.status, 200);
  });

  it("login creates session; DB stores token hash not raw token; cookie HttpOnly SameSite Secure", async () => {
    const { user, password, email } = await createUser();
    const response = await postLogin(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "user-agent": "test-agent" },
        body: JSON.stringify({ email, password }),
      }),
    );
    assert.equal(response.status, 200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    assert.match(setCookie, new RegExp(`${SESSION_COOKIE_NAME}=`));
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);

    const match = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    assert.ok(match);
    const rawToken = match[1];
    const sessions = await prisma.session.findMany({ where: { userId: user.id } });
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].tokenHash, hashSessionToken(rawToken));
    assert.notEqual(sessions[0].tokenHash, rawToken);
    assert.equal(sessions[0].tokenHash.includes(rawToken), false);

    const prodOpts = sessionCookieOptions(undefined, { nodeEnv: "production" });
    assert.equal(prodOpts.httpOnly, true);
    assert.equal(prodOpts.sameSite, "lax");
    assert.equal(prodOpts.secure, true);
    assert.equal(prodOpts.path, "/");
  });

  it("expired session rejected", async () => {
    const { user } = await createUser();
    const { rawToken, session } = await createSession({ userId: user.id });
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    assert.equal(await getSessionByRawToken(rawToken), null);
  });

  it("logout revokes session and is idempotent", async () => {
    const { user } = await createUser();
    const { rawToken } = await createSession({ userId: user.id });

    const first = await postLogout(
      new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: {
          cookie: cookieHeader(rawToken),
          origin: "http://localhost",
          host: "localhost",
        },
      }),
    );
    assert.equal(first.status, 200);
    assert.equal(await getSessionByRawToken(rawToken), null);

    const second = await postLogout(
      new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: { host: "localhost" },
      }),
    );
    assert.equal(second.status, 200);
  });

  it("/api/auth/me hides sensitive fields; unauthenticated 401 JSON", async () => {
    const unauth = await getMe(new Request("http://localhost/api/auth/me"));
    assert.equal(unauth.status, 401);
    const unauthBody = await unauth.json();
    assert.equal(typeof unauthBody.error, "string");
    assert.equal("passwordHash" in unauthBody, false);

    const { user } = await createUser({ name: "Nell" });
    const { rawToken } = await createSession({ userId: user.id });
    const me = await getMe(
      new Request("http://localhost/api/auth/me", {
        headers: { cookie: cookieHeader(rawToken) },
      }),
    );
    assert.equal(me.status, 200);
    const body = await me.json();
    assert.deepEqual(Object.keys(body.user).sort(), ["email", "id", "name"]);
    assert.equal(body.user.email, user.email);
    assert.equal("passwordHash" in body.user, false);
    assert.equal("tokenHash" in body, false);
  });

  it("protected CRM/API auth rejects unauthenticated; API is JSON not redirect", async () => {
    await assert.rejects(
      () => requireAuth(new Request("http://localhost/api/properties")),
      (error: unknown) => error instanceof Error && error.name === "AuthError",
    );
    const me = await getMe(new Request("http://localhost/api/auth/me"));
    assert.equal(me.status, 401);
    assert.match(me.headers.get("content-type") ?? "", /application\/json/);
    assert.equal(me.headers.get("location"), null);
  });

  it("public CIAN feeds remain accessible without session", async () => {
    assert.equal(classifyApiPath("/api/feeds/cian/long-term.xml"), ROUTE_ACCESS.PUBLIC);
    assert.equal(classifyApiPath("/api/feeds/cian/sale.xml"), ROUTE_ACCESS.PUBLIC);
    const lt = await getCianLongTermFeed();
    assert.equal(lt.status, 200);
    const sale = await getCianSaleFeed();
    assert.equal(sale.status, 200);
  });

  it("state-changing protected API rejects invalid cross-origin", async () => {
    const bad = assertTrustedOrigin(
      new Request("http://localhost/api/properties", {
        method: "POST",
        headers: { origin: "https://evil.example", host: "localhost" },
      }),
    );
    assert.equal(bad.ok, false);

    const good = assertTrustedOrigin(
      new Request("http://localhost/api/properties", {
        method: "POST",
        headers: { origin: "http://localhost", host: "localhost" },
      }),
    );
    assert.equal(good.ok, true);

    assert.equal(classifyApiPath("/api/integrations/avito/callback"), ROUTE_ACCESS.EXTERNAL_INTEGRATION);
    assert.equal(classifyApiPath("/api/properties"), ROUTE_ACCESS.AUTH_REQUIRED);
  });

  it("login rate limiting works", async () => {
    const keys = ["ip:1.2.3.4", "email:rate@example.com"];
    clearLoginFailures(keys);
    for (let i = 0; i < 10; i++) {
      recordLoginFailure(keys);
    }
    const blocked = checkLoginRateLimit(keys);
    assert.equal(blocked.allowed, false);
    assert.ok((blocked.retryAfterSec ?? 0) > 0);
  });

  it("seed/bootstrap credentials are not hard-coded; repeated seed does not reset password", async () => {
    const loginSource = await import("node:fs").then((fs) =>
      fs.readFileSync("app/api/auth/login/route.ts", "utf8"),
    );
    assert.equal(loginSource.includes("password123"), false);
    assert.equal(loginSource.includes("admin@"), false);

    process.env.ADMIN_EMAIL = "Bootstrap@Example.com";
    process.env.ADMIN_PASSWORD = "bootstrap-password-99";
    const first = await bootstrapAdminUser();
    assert.equal(first.created, true);

    const before = await prisma.user.findUniqueOrThrow({
      where: { email: "bootstrap@example.com" },
    });
    const originalHash = before.passwordHash;

    process.env.ADMIN_PASSWORD = "changed-password-should-not-apply";
    const second = await bootstrapAdminUser();
    assert.equal(second.created, false);
    assert.equal(second.skipped, true);

    const after = await prisma.user.findUniqueOrThrow({
      where: { email: "bootstrap@example.com" },
    });
    assert.equal(after.passwordHash, originalHash);
    assert.equal(await verifyPassword(after.passwordHash, "bootstrap-password-99"), true);
  });

  it("revokeSession removes access", async () => {
    const { user } = await createUser();
    const { rawToken } = await createSession({ userId: user.id });
    await revokeSessionByRawToken(rawToken);
    assert.equal(await getSessionByRawToken(rawToken), null);
  });
});
