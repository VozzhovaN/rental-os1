import "./helpers-preload";
import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import { GET as getDayPrices, PUT as putDayPrices } from "@/app/api/pricing/day-prices/route";
import { API_ROUTE_REGISTRY } from "@/lib/auth/api-registry";
import { classifyApiPath, ROUTE_ACCESS } from "@/lib/auth/route-access";
import {
  DAY_PRICE_MAX_RANGE_DAYS,
  PricingDomainError,
  effectiveDayPrice,
  getDayPriceData,
  setDayPriceRange,
  setDayPriceRangeSchema,
} from "@/lib/pricing/day-prices";
import { prisma } from "@/lib/prisma";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";
import { authedRequest, createTestSessionCookie } from "../helpers/auth";

async function makeProperty(dailyPrice: number | null) {
  return prisma.property.create({
    data: {
      name: "Ценовой объект",
      slug: `price-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: "APARTMENT",
      status: "ACTIVE",
      address: "a",
      city: "c",
      district: "d",
      area: 40,
      rooms: 1,
      bedrooms: 1,
      bathrooms: 1,
      guests: 2,
      description: "x",
      shortDescription: "x",
      ownerName: "O",
      ownerPhone: "+7",
      managementType: "OWN",
      dailyPrice,
    },
  });
}

describe("property day prices — domain (stage 16.0)", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  afterEach(async () => {
    await resetFixtures();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  it("effective price falls back to base dailyPrice when no override", async () => {
    await resetFixtures();
    const p = await makeProperty(6000);

    const data = await getDayPriceData({
      propertyIds: [p.id],
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
    });

    const eff = effectiveDayPrice(data, p.id, "2026-09-15");
    assert.equal(eff.price, 6000);
    assert.equal(eff.isOverride, false);
  });

  it("effective price is null when no override and no base price", async () => {
    await resetFixtures();
    const p = await makeProperty(null);
    const data = await getDayPriceData({
      propertyIds: [p.id],
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
    });
    const eff = effectiveDayPrice(data, p.id, "2026-09-15");
    assert.equal(eff.price, null);
    assert.equal(eff.isOverride, false);
  });

  it("setDayPriceRange sets an override on every day in the inclusive range", async () => {
    await resetFixtures();
    const p = await makeProperty(6000);

    const res = await setDayPriceRange({
      propertyId: p.id,
      dateFrom: "2026-09-10",
      dateTo: "2026-09-12",
      price: 9000,
    });
    assert.equal(res.affectedDays, 3);

    const rows = await prisma.propertyDayPrice.findMany({ where: { propertyId: p.id } });
    assert.equal(rows.length, 3);
    for (const r of rows) assert.equal(r.price, 9000);

    const data = await getDayPriceData({
      propertyIds: [p.id],
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
    });
    // Inside range → override; outside → base.
    assert.deepEqual(effectiveDayPrice(data, p.id, "2026-09-10"), { price: 9000, isOverride: true });
    assert.deepEqual(effectiveDayPrice(data, p.id, "2026-09-12"), { price: 9000, isOverride: true });
    assert.deepEqual(effectiveDayPrice(data, p.id, "2026-09-13"), { price: 6000, isOverride: false });
    assert.deepEqual(effectiveDayPrice(data, p.id, "2026-09-09"), { price: 6000, isOverride: false });
  });

  it("re-applying a range updates existing overrides (idempotent upsert)", async () => {
    await resetFixtures();
    const p = await makeProperty(6000);
    await setDayPriceRange({ propertyId: p.id, dateFrom: "2026-09-10", dateTo: "2026-09-12", price: 9000 });
    await setDayPriceRange({ propertyId: p.id, dateFrom: "2026-09-10", dateTo: "2026-09-12", price: 7000 });

    const rows = await prisma.propertyDayPrice.findMany({ where: { propertyId: p.id } });
    assert.equal(rows.length, 3);
    for (const r of rows) assert.equal(r.price, 7000);
  });

  it("resetting (price null) removes overrides → back to base price", async () => {
    await resetFixtures();
    const p = await makeProperty(6000);
    await setDayPriceRange({ propertyId: p.id, dateFrom: "2026-09-10", dateTo: "2026-09-12", price: 9000 });

    const reset = await setDayPriceRange({
      propertyId: p.id,
      dateFrom: "2026-09-11",
      dateTo: "2026-09-12",
      price: null,
    });
    assert.equal(reset.affectedDays, 2);

    const rows = await prisma.propertyDayPrice.findMany({ where: { propertyId: p.id } });
    assert.equal(rows.length, 1); // only 2026-09-10 remains

    const data = await getDayPriceData({
      propertyIds: [p.id],
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
    });
    assert.deepEqual(effectiveDayPrice(data, p.id, "2026-09-10"), { price: 9000, isOverride: true });
    assert.deepEqual(effectiveDayPrice(data, p.id, "2026-09-11"), { price: 6000, isOverride: false });
  });

  it("rejects unknown property and oversized/invalid ranges", async () => {
    await resetFixtures();
    const p = await makeProperty(6000);

    await assert.rejects(
      () => setDayPriceRange({ propertyId: "missing", dateFrom: "2026-09-01", dateTo: "2026-09-01", price: 1000 }),
      (e) => e instanceof PricingDomainError && e.code === "NOT_FOUND",
    );

    await assert.rejects(
      () =>
        setDayPriceRange({
          propertyId: p.id,
          dateFrom: "2026-01-01",
          dateTo: "2027-12-31",
          price: 1000,
        }),
      (e) => e instanceof PricingDomainError && e.code === "VALIDATION",
    );

    // Schema-level guards.
    assert.equal(
      setDayPriceRangeSchema.safeParse({
        propertyId: p.id,
        dateFrom: "2026-09-12",
        dateTo: "2026-09-10",
        price: 1000,
      }).success,
      false,
    );
    assert.equal(
      setDayPriceRangeSchema.safeParse({
        propertyId: p.id,
        dateFrom: "2026-09-10",
        dateTo: "2026-09-12",
        price: -5,
      }).success,
      false,
    );
    assert.ok(DAY_PRICE_MAX_RANGE_DAYS > 0);
  });
});

describe("property day prices — API (stage 16.0)", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  afterEach(async () => {
    await resetFixtures();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  it("route is registered and auth-required", () => {
    assert.equal(classifyApiPath("/api/pricing/day-prices"), ROUTE_ACCESS.AUTH_REQUIRED);
    assert.ok(API_ROUTE_REGISTRY.some((r) => r.pathPattern === "/api/pricing/day-prices"));
  });

  it("unauthenticated GET and PUT are rejected", async () => {
    const g = await getDayPrices(
      new Request("http://localhost/api/pricing/day-prices?dateFrom=2026-09-01&dateTo=2026-09-30"),
    );
    assert.equal(g.status, 401);

    const p = await putDayPrices(
      new Request("http://localhost/api/pricing/day-prices", {
        method: "PUT",
        headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
        body: JSON.stringify({ propertyId: "x", dateFrom: "2026-09-01", dateTo: "2026-09-01", price: 100 }),
      }),
    );
    assert.equal(p.status, 401);
  });

  it("authenticated PUT sets prices and GET reflects them", async () => {
    await resetFixtures();
    const prop = await makeProperty(5000);
    const { cookie } = await createTestSessionCookie();

    const put = await putDayPrices(
      authedRequest("http://localhost/api/pricing/day-prices", cookie, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          propertyId: prop.id,
          dateFrom: "2026-09-10",
          dateTo: "2026-09-11",
          price: 8800,
        }),
      }),
    );
    assert.equal(put.status, 200);
    assert.equal(put.headers.get("Cache-Control"), "no-store");
    const putBody = await put.json();
    assert.equal(putBody.affectedDays, 2);

    const get = await getDayPrices(
      authedRequest(
        `http://localhost/api/pricing/day-prices?propertyId=${prop.id}&dateFrom=2026-09-01&dateTo=2026-09-30`,
        cookie,
      ),
    );
    assert.equal(get.status, 200);
    const body = await get.json();
    assert.equal(body.data.basePriceByProperty[prop.id], 5000);
    assert.equal(body.data.overrides[prop.id]["2026-09-10"], 8800);
    assert.equal(body.data.overrides[prop.id]["2026-09-11"], 8800);
  });

  it("authenticated PUT with invalid body → 400", async () => {
    const { cookie } = await createTestSessionCookie();
    const put = await putDayPrices(
      authedRequest("http://localhost/api/pricing/day-prices", cookie, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId: "", dateFrom: "bad", dateTo: "bad", price: 1.5 }),
      }),
    );
    assert.equal(put.status, 400);
  });
});
