import "./helpers-preload";
import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { GET as getAvitoCallback } from "@/app/api/integrations/avito/callback/route";
import { GET as getCianLongTermFeed } from "@/app/api/feeds/cian/long-term.xml/route";
import { GET as getCianSaleFeed } from "@/app/api/feeds/cian/sale.xml/route";
import { GET as getMe } from "@/app/api/auth/me/route";
import { POST as postLogin } from "@/app/api/auth/login/route";
import { GET as getProperties } from "@/app/api/properties/route";
import { GET as getIntegrations } from "@/app/api/integrations/route";
import { API_ROUTE_REGISTRY } from "@/lib/auth/api-registry";
import { assertTrustedOrigin } from "@/lib/auth/csrf";
import { getAppOrigin } from "@/lib/auth/env";
import { createPropertySchema } from "@/lib/validations/property";
import { updateLongTermListingSchema } from "@/lib/validations/long-term-listing";
import { escapeXml } from "@/lib/publications/providers/cian/xml";
import { getSecurityHeaders } from "@/lib/security/headers";
import { redactSecrets } from "@/lib/integrations/crypto";
import { resolveAvitoApiUrl } from "@/lib/integrations/http";
import { IntegrationError } from "@/lib/integrations/types";
import { prisma } from "@/lib/prisma";
import { prepareTestDatabase } from "../helpers/db";
import { authedRequest, createTestSessionCookie, createTestUser } from "../helpers/auth";

function walkRouteFiles(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkRouteFiles(full, base));
    else if (name === "route.ts") out.push(full.slice(base.length + 1).replaceAll("\\", "/"));
  }
  return out;
}

describe("security hardening (stage 11.3)", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  afterEach(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  it("security headers + CSP present; framing blocked; no wildcard CORS helper", () => {
    const headers = getSecurityHeaders("production");
    assert.equal(headers["X-Content-Type-Options"], "nosniff");
    assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
    assert.match(headers["Permissions-Policy"], /camera=\(\)/);
    assert.equal(headers["X-Frame-Options"], "DENY");
    assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
    assert.match(headers["Content-Security-Policy"], /default-src 'self'/);
    assert.match(headers["Content-Security-Policy"], /object-src 'none'/);
    assert.equal(headers["Content-Security-Policy"].includes("*"), false);
    assert.equal("Access-Control-Allow-Origin" in headers, false);

    const dev = getSecurityHeaders("development");
    assert.match(dev["Content-Security-Policy"], /unsafe-eval/);
  });

  it("protected and auth responses use no-store", async () => {
    const unauth = await getProperties(new Request("http://localhost/api/properties"));
    assert.equal(unauth.status, 401);
    assert.equal(unauth.headers.get("Cache-Control"), "no-store");

    const { user, password, email } = await createTestUser();
    const login = await postLogin(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }),
    );
    assert.equal(login.status, 200);
    assert.equal(login.headers.get("Cache-Control"), "no-store");
    void user;

    const { cookie } = await createTestSessionCookie();
    const me = await getMe(authedRequest("http://localhost/api/auth/me", cookie));
    assert.equal(me.headers.get("Cache-Control"), "no-store");
  });

  it("CSRF Origin validation with APP_ORIGIN", () => {
    const previous = process.env.APP_ORIGIN;
    try {
      process.env.APP_ORIGIN = "https://crm.example.com";
      assert.equal(getAppOrigin(), "https://crm.example.com");
      assert.equal(
        assertTrustedOrigin(
          new Request("https://crm.example.com/api/x", {
            method: "POST",
            headers: { origin: "https://evil.example", host: "crm.example.com" },
          }),
        ).ok,
        false,
      );
      assert.equal(
        assertTrustedOrigin(
          new Request("https://crm.example.com/api/x", {
            method: "POST",
            headers: { origin: "https://crm.example.com", host: "crm.example.com" },
          }),
        ).ok,
        true,
      );
    } finally {
      process.env.APP_ORIGIN = previous || "http://localhost";
    }
  });

  it("XML special characters escaped", () => {
    const escaped = escapeXml(`a<b>&"'`);
    assert.equal(escaped.includes("<"), false);
    assert.equal(escaped.includes(">"), false);
    assert.match(escaped, /&lt;/);
    assert.match(escaped, /&amp;/);
  });

  it("public feeds expose no Buyer/Guest/session/secrets", async () => {
    for (const getFeed of [getCianLongTermFeed, getCianSaleFeed]) {
      const response = await getFeed();
      assert.equal(response.status, 200);
      const xml = await response.text();
      assert.equal(/Buyer|buyerId|Guest|passwordHash|SESSION_SECRET|accessToken|rental_os_session/i.test(xml), false);
      assert.equal(xml.includes("<!DOCTYPE"), false);
      assert.equal(xml.includes("<!ENTITY"), false);
    }
  });

  it("mass assignment / oversized / unsafe enum rejected", () => {
    const oversized = createPropertySchema.safeParse({
      name: "x",
      type: "APARTMENT",
      status: "ACTIVE",
      address: "a".repeat(501),
      city: "City",
      district: "D",
      area: 10,
      rooms: 1,
      bedrooms: 1,
      bathrooms: 1,
      guests: 1,
      description: "d",
      shortDescription: "s",
      ownerName: "o",
      ownerPhone: "+7000",
      managementType: "OWN",
      passwordHash: "hack",
      isActive: true,
    });
    assert.equal(oversized.success, false);

    const badEnum = updateLongTermListingSchema.safeParse({ status: "PUBLISHED" });
    assert.equal(badEnum.success, false);

    const unknownField = createPropertySchema.safeParse({
      name: "x",
      type: "APARTMENT",
      status: "ACTIVE",
      address: "addr",
      city: "City",
      district: "D",
      area: 10,
      rooms: 1,
      bedrooms: 1,
      bathrooms: 1,
      guests: 1,
      description: "d",
      shortDescription: "s",
      ownerName: "o",
      ownerPhone: "+70000000000",
      managementType: "OWN",
      externalId: "nope",
    });
    assert.equal(unknownField.success, false);
  });

  it("invalid session and inactive user rejected", async () => {
    const bad = await getProperties(
      new Request("http://localhost/api/properties", {
        headers: { cookie: "rental_os_session=invalid-token-value-here" },
      }),
    );
    assert.equal(bad.status, 401);
    assert.equal("stack" in (await bad.json()), false);

    const inactive = await createTestUser({ isActive: false, email: "dead@example.com" });
    const { createSession, getSessionByRawToken } = await import("@/lib/auth/session");
    const session = await createSession({ userId: inactive.user.id });
    assert.equal(await getSessionByRawToken(session.rawToken), null);
  });

  it("OAuth state invalid rejected; cookie cleared (one-time semantics)", async () => {
    const response = await getAvitoCallback(
      new Request(
        "http://localhost/api/integrations/avito/callback?code=abc&state=wrong",
        { headers: { cookie: "avito_oauth_state=expected" } },
      ),
    );
    assert.ok(response.status === 307 || response.status === 302);
    const setCookie = response.headers.get("set-cookie") ?? "";
    assert.match(setCookie, /avito_oauth_state=/);
    assert.match(setCookie, /Max-Age=0|max-age=0/i);

    const expiredMissing = await getAvitoCallback(
      new Request("http://localhost/api/integrations/avito/callback?code=abc&state=x"),
    );
    assert.ok(expiredMissing.status === 307 || expiredMissing.status === 302);
  });

  it("no user-controlled arbitrary server fetch; integration tokens redacted", async () => {
    assert.throws(
      () => resolveAvitoApiUrl("https://169.254.169.254/latest/meta-data/"),
      (e: unknown) => e instanceof IntegrationError,
    );

    const { cookie } = await createTestSessionCookie();
    const integrations = await getIntegrations(
      authedRequest("http://localhost/api/integrations", cookie),
    );
    const text = await integrations.text();
    assert.equal(text.includes("accessToken"), false);
    assert.equal(text.includes("refreshToken"), false);
    assert.equal(text.includes("enc:v1:"), false);
  });

  it("error responses omit stack/Prisma internals; redaction helper works", async () => {
    const response = await getProperties(new Request("http://localhost/api/properties"));
    const body = await response.json();
    assert.equal("stack" in body, false);
    assert.equal(JSON.stringify(body).includes("PrismaClient"), false);
    assert.equal(JSON.stringify(body).includes("prisma/"), false);

    const redacted = redactSecrets(
      "password=secret SESSION_SECRET=abc Cookie: rental_os_session=tok Bearer xyz",
    );
    assert.equal(redacted.includes("secret"), false);
    assert.equal(redacted.includes("tok"), false);
    assert.equal(redacted.includes("xyz"), false);
  });

  it("API route classification still complete", () => {
    const onDisk = walkRouteFiles("app/api");
    const registered = new Set(API_ROUTE_REGISTRY.map((r) => r.routeFile));
    for (const file of onDisk) {
      assert.ok(registered.has(file), `Unregistered: ${file}`);
    }
    assert.equal(onDisk.length, API_ROUTE_REGISTRY.length);
  });
});
