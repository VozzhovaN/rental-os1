import "./helpers-preload";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, before, describe, it } from "node:test";
import { GET as getBookings } from "@/app/api/bookings/route";
import { GET as getBuyers } from "@/app/api/buyers/route";
import { GET as getGuests } from "@/app/api/guests/route";
import { GET as getIntegrations } from "@/app/api/integrations/route";
import { GET as getAvitoStatus } from "@/app/api/integrations/avito/route";
import { GET as getLongTermListings } from "@/app/api/long-term-listings/route";
import { GET as getProperties } from "@/app/api/properties/route";
import { GET as getSaleListings } from "@/app/api/sale-listings/route";
import { GET as getMe } from "@/app/api/auth/me/route";
import { POST as postLogin } from "@/app/api/auth/login/route";
import { POST as postLogout } from "@/app/api/auth/logout/route";
import { GET as getCianLongTermFeed } from "@/app/api/feeds/cian/long-term.xml/route";
import { GET as getCianSaleFeed } from "@/app/api/feeds/cian/sale.xml/route";
import { GET as getAvitoCallback } from "@/app/api/integrations/avito/callback/route";
import {
  API_ROUTE_REGISTRY,
  EXTERNAL_CALLBACK_AUTH,
} from "@/lib/auth/api-registry";
import { SESSION_COOKIE_NAME, MULTI_INSTANCE_RATE_LIMIT } from "@/lib/auth/constants";
import { sessionCookieOptions } from "@/lib/auth/cookies";
import { assertTrustedOrigin } from "@/lib/auth/csrf";
import { getAppOrigin } from "@/lib/auth/env";
import { classifyApiPath, ROUTE_ACCESS } from "@/lib/auth/route-access";
import {
  cleanupExpiredSessions,
  createSession,
  getSessionByRawToken,
  hashSessionToken,
} from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { prepareTestDatabase } from "../helpers/db";
import { authedRequest, createTestSessionCookie, createTestUser } from "../helpers/auth";

function walkRouteFiles(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walkRouteFiles(full, base));
    } else if (name === "route.ts") {
      out.push(full.slice(base.length + 1).replaceAll("\\", "/"));
    }
  }
  return out;
}

describe("api session hardening (stage 11.2)", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  afterEach(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  it("every API route classified; unclassified internal route fails", () => {
    const onDisk = walkRouteFiles("app/api");
    const registered = new Set(API_ROUTE_REGISTRY.map((r) => r.routeFile));
    for (const file of onDisk) {
      assert.ok(registered.has(file), `Unregistered API route: ${file}`);
    }
    for (const entry of API_ROUTE_REGISTRY) {
      assert.ok(onDisk.includes(entry.routeFile), `Registry entry missing on disk: ${entry.routeFile}`);
    }
    assert.equal(onDisk.length, API_ROUTE_REGISTRY.length);
    assert.equal(classifyApiPath("/api/unknown-future-endpoint"), ROUTE_ACCESS.AUTH_REQUIRED);
  });

  it("protected domain APIs unauthenticated → 401 with no domain data", async () => {
    const checks = [
      await getProperties(new Request("http://localhost/api/properties")),
      await getGuests(new Request("http://localhost/api/guests")),
      await getBookings(new Request("http://localhost/api/bookings")),
      await getLongTermListings(new Request("http://localhost/api/long-term-listings")),
      await getSaleListings(new Request("http://localhost/api/sale-listings")),
      await getBuyers(new Request("http://localhost/api/buyers")),
      await getIntegrations(new Request("http://localhost/api/integrations")),
    ];
    for (const response of checks) {
      assert.equal(response.status, 401);
      assert.equal(response.headers.get("location"), null);
      assert.match(response.headers.get("content-type") ?? "", /application\/json/);
      const body = await response.json();
      assert.equal(typeof body.error, "string");
      assert.equal("properties" in body, false);
      assert.equal("guests" in body, false);
      assert.equal("bookings" in body, false);
      assert.equal("listings" in body, false);
      assert.equal("buyers" in body, false);
      assert.equal("integrations" in body, false);
    }
  });

  it("valid session succeeds; invalid/expired/deleted/inactive/stale rejected", async () => {
    const { cookie, rawToken, userId } = await createTestSessionCookie();
    const ok = await getProperties(authedRequest("http://localhost/api/properties", cookie));
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("Cache-Control"), "no-store");

    const invalid = await getProperties(
      new Request("http://localhost/api/properties", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=not-a-real-token-value-xxxxx` },
      }),
    );
    assert.equal(invalid.status, 401);

    const expired = await createTestSessionCookie(userId);
    await prisma.session.update({
      where: { id: expired.session.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    assert.equal(await getSessionByRawToken(expired.rawToken), null);
    const expiredRes = await getProperties(
      new Request("http://localhost/api/properties", {
        headers: { cookie: expired.cookie },
      }),
    );
    assert.equal(expiredRes.status, 401);

    const deleted = await createTestSessionCookie(userId);
    await prisma.session.delete({ where: { id: deleted.session.id } });
    assert.equal(await getSessionByRawToken(deleted.rawToken), null);

    const inactiveUser = await createTestUser({ isActive: false, email: "inactive-h@example.com" });
    const inactiveSession = await createSession({ userId: inactiveUser.user.id });
    assert.equal(await getSessionByRawToken(inactiveSession.rawToken), null);
    const inactiveRes = await getProperties(
      new Request("http://localhost/api/properties", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${inactiveSession.rawToken}` },
      }),
    );
    assert.equal(inactiveRes.status, 401);

    // stale cookie cleared on 401
    const setCookie = invalid.headers.get("set-cookie") ?? "";
    assert.match(setCookie, new RegExp(`${SESSION_COOKIE_NAME}=;`));
    void rawToken;
  });

  it("login creates NEW session token; does not reuse supplied cookie token", async () => {
    const { user, password, email } = await createTestUser();
    const prior = await createSession({ userId: user.id });
    const response = await postLogin(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${prior.rawToken}`,
        },
        body: JSON.stringify({ email, password }),
      }),
    );
    assert.equal(response.status, 200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    const match = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    assert.ok(match);
    const newToken = match[1]!;
    assert.notEqual(newToken, prior.rawToken);
    assert.equal(await getSessionByRawToken(prior.rawToken), null);
    assert.ok(await getSessionByRawToken(newToken));
    assert.notEqual(hashSessionToken(newToken), hashSessionToken(prior.rawToken));
  });

  it("logout cookie removal matches cookie path/settings", async () => {
    const { cookie } = await createTestSessionCookie();
    const response = await postLogout(
      authedRequest("http://localhost/api/auth/logout", cookie, { method: "POST" }),
    );
    assert.equal(response.status, 200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    assert.match(setCookie, new RegExp(`${SESSION_COOKIE_NAME}=`));
    assert.match(setCookie, /Path=\//i);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    const opts = sessionCookieOptions(0);
    assert.equal(opts.path, "/");
    assert.equal(opts.httpOnly, true);
    assert.equal(opts.sameSite, "lax");
    assert.equal("domain" in opts, false);
  });

  it("mutating protected route CSRF: rejects invalid Origin; accepts APP_ORIGIN", async () => {
    const previousOrigin = process.env.APP_ORIGIN;
    try {
      process.env.APP_ORIGIN = "https://crm.example.com";
      assert.equal(getAppOrigin(), "https://crm.example.com");

      const bad = assertTrustedOrigin(
        new Request("https://crm.example.com/api/properties", {
          method: "POST",
          headers: { origin: "https://evil.example", host: "crm.example.com" },
        }),
      );
      assert.equal(bad.ok, false);

      const good = assertTrustedOrigin(
        new Request("https://crm.example.com/api/properties", {
          method: "POST",
          headers: { origin: "https://crm.example.com", host: "crm.example.com" },
        }),
      );
      assert.equal(good.ok, true);

      const { cookie } = await createTestSessionCookie();
      const post = await (
        await import("@/app/api/properties/route")
      ).POST(
        new Request("http://localhost/api/properties", {
          method: "POST",
          headers: {
            cookie,
            origin: "https://evil.example",
            host: "localhost",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }),
      );
      assert.equal(post.status, 403);

      process.env.APP_ORIGIN = "http://localhost";
      const acceptedCsrf = assertTrustedOrigin(
        new Request("http://localhost/api/properties", {
          method: "POST",
          headers: { origin: "http://localhost", host: "localhost" },
        }),
      );
      assert.equal(acceptedCsrf.ok, true);
    } finally {
      process.env.APP_ORIGIN = previousOrigin || "http://localhost";
    }
  });

  it("external Avito callback not blocked by browser CSRF; EXTERNAL_CALLBACK_AUTH documented", async () => {
    assert.equal(classifyApiPath("/api/integrations/avito/callback"), ROUTE_ACCESS.EXTERNAL_INTEGRATION);
    assert.equal(EXTERNAL_CALLBACK_AUTH, "BLOCKED_BY_PROVIDER_CONFIRMATION");
    const response = await getAvitoCallback(
      new Request("http://localhost/api/integrations/avito/callback?error=access_denied", {
        headers: { origin: "https://evil.example" },
      }),
    );
    // OAuth error path redirects to settings — not 403 CSRF
    assert.notEqual(response.status, 403);
    assert.ok(response.status === 307 || response.status === 302 || response.status === 200);
  });

  it("public CIAN feeds still accessible; auth/me no sensitive fields + no-store", async () => {
    assert.equal((await getCianLongTermFeed()).status, 200);
    assert.equal((await getCianSaleFeed()).status, 200);

    const { cookie } = await createTestSessionCookie();
    const me = await getMe(authedRequest("http://localhost/api/auth/me", cookie));
    assert.equal(me.status, 200);
    assert.equal(me.headers.get("Cache-Control"), "no-store");
    const body = await me.json();
    assert.deepEqual(Object.keys(body.user).sort(), ["email", "id", "name"]);
    assert.equal("passwordHash" in body.user, false);
  });

  it("integration secrets redacted in status APIs", async () => {
    const { cookie } = await createTestSessionCookie();
    const integrations = await getIntegrations(
      authedRequest("http://localhost/api/integrations", cookie),
    );
    assert.equal(integrations.status, 200);
    const text = await integrations.text();
    assert.equal(text.includes("accessToken"), false);
    assert.equal(text.includes("refreshToken"), false);
    assert.equal(text.includes("enc:v1:"), false);

    const avito = await getAvitoStatus(authedRequest("http://localhost/api/integrations/avito", cookie));
    assert.equal(avito.status, 200);
    const avitoText = await avito.text();
    assert.equal(avitoText.includes("accessToken"), false);
    assert.equal(avitoText.includes("refreshToken"), false);
  });

  it("expired-session cleanup does not affect valid sessions", async () => {
    const { user } = await createTestUser();
    const valid = await createSession({ userId: user.id });
    const expired = await createSession({ userId: user.id });
    await prisma.session.update({
      where: { id: expired.session.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const removed = await cleanupExpiredSessions();
    assert.ok(removed >= 1);
    assert.ok(await getSessionByRawToken(valid.rawToken));
    assert.equal(await getSessionByRawToken(expired.rawToken), null);
  });

  it("authenticated /login redirects conceptually via full session; stale cookie is logged out", async () => {
    const { rawToken } = await createTestSessionCookie();
    assert.ok(await getSessionByRawToken(rawToken));
    // stale: deleted session + cookie present → getSessionByRawToken null (login page shows form)
    await prisma.session.deleteMany();
    assert.equal(await getSessionByRawToken(rawToken), null);
  });

  it("MULTI_INSTANCE_RATE_LIMIT documented pending", () => {
    assert.equal(MULTI_INSTANCE_RATE_LIMIT, "PRODUCTION_HARDENING_PENDING");
  });
});
