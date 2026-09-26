import "./helpers-preload";
import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import { GET as getDashboard } from "@/app/api/finance/dashboard/route";
import { API_ROUTE_REGISTRY } from "@/lib/auth/api-registry";
import { classifyApiPath, ROUTE_ACCESS } from "@/lib/auth/route-access";
import {
  FinanceDomainError,
  classifyExpenseSegment,
  classifyExpenseDirection,
  createCommissionPayment,
  createFinancialTransaction,
  createManualExpense,
  ensureCommissionSnapshot,
  getFinanceDashboard,
  recordBookingPayment,
  resolveDashboardPeriod,
  financeDashboardQuerySchema,
} from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";
import { authedRequest, createTestSessionCookie } from "../helpers/auth";

async function createProp(opts: {
  managementType: "OWN" | "COMMISSION";
  rentCollectionMode?: "OPERATOR" | "OWNER_DIRECT";
  commissionDaily?: number;
}) {
  return prisma.property.create({
    data: {
      name: `Dash ${opts.managementType}`,
      slug: `dash-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
      managementType: opts.managementType,
      rentCollectionMode: opts.rentCollectionMode ?? "OPERATOR",
      commissionDaily: opts.commissionDaily ?? 20,
    },
  });
}

async function createBooking(propertyId: string, channelId: string, total: number) {
  const guest = await prisma.guest.create({ data: { firstName: "D", lastName: "T" } });
  return prisma.booking.create({
    data: {
      propertyId,
      guestId: guest.id,
      salesChannelId: channelId,
      checkIn: new Date("2026-09-10T14:00:00.000Z"),
      checkOut: new Date("2026-09-12T12:00:00.000Z"),
      guestsCount: 1,
      totalAmount: total,
      status: "CONFIRMED",
    },
  });
}

describe("finance dashboard (stage 12.5)", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  afterEach(async () => {
    await resetFixtures();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  it("period resolver and query validation", () => {
    const month = resolveDashboardPeriod({
      period: "month",
      now: new Date("2026-09-15T12:00:00.000Z"),
    });
    assert.equal(month.dateFrom, "2026-09-01");
    assert.equal(month.dateTo, "2026-09-30");
    assert.equal(month.previousFrom, "2026-08-01");
    assert.equal(month.previousTo, "2026-08-31");

    assert.equal(
      financeDashboardQuerySchema.safeParse({
        period: "custom",
        dateFrom: "2026-09-10",
        dateTo: "2026-09-01",
      }).success,
      false,
    );
    assert.equal(
      financeDashboardQuerySchema.safeParse({ period: "month", managementType: "OWN" }).success,
      true,
    );
  });

  it("OWN revenue and expenses; PASS_THROUGH excluded; commission received is revenue", async () => {
    const { channel } = await resetFixtures();
    const own = await createProp({ managementType: "OWN" });
    const booking = await createBooking(own.id, channel.id, 10000);
    await recordBookingPayment(booking.id, {
      amount: 10000,
      paidAt: new Date("2026-09-05T12:00:00.000Z"),
      method: null,
      note: null,
    });
    await createManualExpense({
      propertyId: own.id,
      amount: 2000,
      category: "CLEANING",
      occurredAt: new Date("2026-09-06T12:00:00.000Z"),
      description: "уборка",
    });

    const dash = await getFinanceDashboard({
      period: "custom",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
      propertyId: own.id,
    });
    assert.equal(dash.summary.grossRent, 10000);
    assert.equal(dash.summary.businessRevenue, 10000);
    assert.equal(dash.summary.totalExpenses, 2000);
    assert.equal(dash.summary.netProfit, 8000);

    const commission = await createProp({
      managementType: "COMMISSION",
      rentCollectionMode: "OPERATOR",
      commissionDaily: 20,
    });
    const cb = await createBooking(commission.id, channel.id, 10000);
    await ensureCommissionSnapshot(cb.id);
    await recordBookingPayment(cb.id, {
      amount: 10000,
      paidAt: new Date("2026-09-05T12:00:00.000Z"),
      method: null,
      note: null,
    });
    // PASS_THROUGH rent must not inflate business revenue without CommissionPayment
    let dashC = await getFinanceDashboard({
      period: "custom",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
      propertyId: commission.id,
    });
    assert.equal(dashC.summary.grossRent, 10000);
    assert.equal(dashC.summary.businessRevenue, 0);

    await createCommissionPayment({
      propertyId: commission.id,
      bookingId: cb.id,
      amount: 2000,
      paidAt: new Date("2026-09-07T12:00:00.000Z"),
      method: null,
      note: null,
    });
    dashC = await getFinanceDashboard({
      period: "custom",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
      propertyId: commission.id,
    });
    assert.equal(dashC.summary.businessRevenue, 2000);
    assert.equal(dashC.commissionSummary.received, 2000);
    assert.equal(dashC.commissionSummary.accrued, 2000);
  });

  it("general expenses reduce business net profit; not assigned to property row", async () => {
    const { channel, property } = await resetFixtures();
    const booking = await createBooking(property.id, channel.id, 5000);
    await recordBookingPayment(booking.id, {
      amount: 5000,
      paidAt: new Date("2026-09-05T12:00:00.000Z"),
      method: null,
      note: null,
    });
    await createManualExpense({
      propertyId: null,
      amount: 1000,
      category: "ADVERTISING",
      occurredAt: new Date("2026-09-06T12:00:00.000Z"),
      description: "общая реклама",
    });

    const dash = await getFinanceDashboard({
      period: "custom",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
      propertyId: property.id,
    });
    // property-scoped dashboard: general expenses with propertyId filter may exclude null —
    // global view:
    const all = await getFinanceDashboard({
      period: "custom",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
    });
    assert.ok(all.reconciliation.generalExpenses >= 1000);
    assert.equal(
      all.summary.netProfit,
      all.summary.businessRevenue - all.summary.totalExpenses,
    );
    const propRow = all.propertyEconomics.find((r) => r.propertyId === property.id);
    assert.ok(propRow);
    assert.equal(propRow.totalExpenses, 0);
    void dash;
  });

  it("OWN/COMMISSION filters; segment short-term; sales gap; SaleListing.price ignored", async () => {
    const { channel } = await resetFixtures();
    const own = await createProp({ managementType: "OWN" });
    const booking = await createBooking(own.id, channel.id, 8000);
    await recordBookingPayment(booking.id, {
      amount: 8000,
      paidAt: new Date("2026-09-05T12:00:00.000Z"),
      method: null,
      note: null,
    });

    const sale = await prisma.saleListing.create({
      data: {
        propertyId: own.id,
        status: "ACTIVE",
        price: 9_999_999,
      },
    });
    void sale;

    const dashOwn = await getFinanceDashboard({
      period: "custom",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
      managementType: "OWN",
    });
    assert.ok(dashOwn.summary.businessRevenue >= 8000);
    assert.ok(!dashOwn.summary.businessRevenue.toString().includes("9999999"));
    assert.equal(dashOwn.salesFinanceStatus.gap, "SALES_FINANCE_REVENUE_GAP");
    assert.equal(dashOwn.salesFinanceStatus.ready, false);
    assert.equal(
      dashOwn.profitBySegment.some((s) => s.id === "SALES"),
      false,
    );

    const dashSt = await getFinanceDashboard({
      period: "custom",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
      segment: "SHORT_TERM",
      propertyId: own.id,
    });
    assert.equal(dashSt.summary.businessRevenue, 8000);

    const dashSales = await getFinanceDashboard({
      period: "custom",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
      segment: "SALES",
    });
    assert.equal(dashSales.summary.businessRevenue, 0);
    assert.equal(dashSales.summary.grossRent, 0);
  });

  it("expense segment classification; timeline; negative profit handling", async () => {
    assert.equal(
      classifyExpenseSegment({ propertyId: "p", bookingId: "b", longTermContractId: null }),
      "SHORT_TERM",
    );
    assert.equal(
      classifyExpenseSegment({ propertyId: "p", bookingId: null, longTermContractId: "c" }),
      "LONG_TERM",
    );
    assert.equal(
      classifyExpenseSegment({ propertyId: null, bookingId: null, longTermContractId: null }),
      "GENERAL",
    );

    const { channel } = await resetFixtures();
    const own = await createProp({ managementType: "OWN" });
    const booking = await createBooking(own.id, channel.id, 1000);
    await recordBookingPayment(booking.id, {
      amount: 1000,
      paidAt: new Date("2026-09-05T12:00:00.000Z"),
      method: null,
      note: null,
    });
    await createManualExpense({
      propertyId: own.id,
      amount: 5000,
      category: "REPAIR",
      occurredAt: new Date("2026-09-06T12:00:00.000Z"),
      description: "ремонт",
    });

    const dash = await getFinanceDashboard({
      period: "custom",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
      propertyId: own.id,
    });
    assert.ok(dash.summary.netProfit < 0);
    // donut slices are non-negative
    for (const s of dash.profitBySegment) {
      assert.ok(s.amount >= 0);
    }
    assert.ok(dash.lossMakingItems.length >= 1);
    assert.ok(dash.timeline.length >= 1);
    assert.ok(["day", "week", "month"].includes(dash.timelineGranularity));
    void channel;
  });

  it("API auth, no-store, registry; invalid query; client totals ignored", async () => {
    assert.equal(classifyApiPath("/api/finance/dashboard"), ROUTE_ACCESS.AUTH_REQUIRED);
    assert.equal(classifyApiPath("/api/finance/dashboard/drilldown"), ROUTE_ACCESS.AUTH_REQUIRED);
    assert.ok(API_ROUTE_REGISTRY.some((r) => r.pathPattern === "/api/finance/dashboard"));

    const unauth = await getDashboard(new Request("http://localhost/api/finance/dashboard"));
    assert.equal(unauth.status, 401);

    const { cookie } = await createTestSessionCookie();
    const ok = await getDashboard(
      authedRequest(
        "http://localhost/api/finance/dashboard?period=month&netProfit=999999",
        cookie,
      ),
    );
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("Cache-Control"), "no-store");
    const body = await ok.json();
    assert.notEqual(body.dashboard.summary.netProfit, 999999);
    assert.ok(typeof body.dashboard.summary.businessRevenue === "number");

    await assert.rejects(
      () =>
        getFinanceDashboard({
          period: "custom",
          dateFrom: "2026-10-01",
          dateTo: "2026-09-01",
        }),
      FinanceDomainError,
    );
  });
});

describe("finance dashboard — expenses by direction (stage 15.0)", () => {
  const RANGE = { period: "custom" as const, dateFrom: "2026-09-01", dateTo: "2026-09-30" };

  before(async () => {
    await prepareTestDatabase();
  });

  afterEach(async () => {
    await resetFixtures();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  const sliceFor = (
    dash: Awaited<ReturnType<typeof getFinanceDashboard>>,
    id: string,
  ) => dash.expensesByDirection.find((s) => s.id === id);

  const assertReconciles = (dash: Awaited<ReturnType<typeof getFinanceDashboard>>) => {
    const d = dash.expenseDirections;
    // Invariant: the four buckets sum to the direction total, with no rounding error.
    assert.equal(d.shortTerm + d.longTerm + d.general + d.unallocated, d.total);
    // And that total equals the dashboard's total expenses (nothing disappears).
    assert.equal(d.total, dash.summary.totalExpenses);
    // Slice amounts (only non-zero sectors) also reconcile to the total.
    const sliceSum = dash.expensesByDirection.reduce((s, x) => s + x.amount, 0);
    assert.equal(sliceSum, d.total);
  };

  it("classifyExpenseDirection: reliable signals only, no guessing", () => {
    assert.equal(
      classifyExpenseDirection({ propertyId: "p", bookingId: "b", longTermContractId: null }),
      "SHORT_TERM",
    );
    assert.equal(
      classifyExpenseDirection({ propertyId: "p", bookingId: null, longTermContractId: "c" }),
      "LONG_TERM",
    );
    assert.equal(
      classifyExpenseDirection({ propertyId: null, bookingId: null, longTermContractId: null }),
      "GENERAL",
    );
    // Property present but no booking/contract link → direction unknown → UNALLOCATED
    assert.equal(
      classifyExpenseDirection({ propertyId: "p", bookingId: null, longTermContractId: null }),
      "UNALLOCATED",
    );
  });

  it("only GENERAL: single sector 100%, reconciles", async () => {
    await resetFixtures();
    await createManualExpense({
      propertyId: null,
      amount: 4000,
      category: "ADVERTISING",
      occurredAt: new Date("2026-09-06T12:00:00.000Z"),
      description: "общая реклама",
    });

    const dash = await getFinanceDashboard(RANGE);
    assert.equal(dash.expenseDirections.general, 4000);
    assert.equal(dash.expensesByDirection.length, 1);
    assert.equal(sliceFor(dash, "GENERAL")?.percent, 100);
    assertReconciles(dash);
  });

  it("only UNALLOCATED: property expense without direction link never disappears", async () => {
    const { property } = await resetFixtures();
    // These mirror the demo: property-level manual operator expenses with no
    // booking/contract link. Before Stage 15.0 they vanished from the donut.
    await createManualExpense({
      propertyId: property.id,
      amount: 3000,
      category: "CLEANING",
      occurredAt: new Date("2026-09-06T12:00:00.000Z"),
      description: "уборка",
    });
    await createManualExpense({
      propertyId: property.id,
      amount: 6250,
      category: "UTILITIES",
      occurredAt: new Date("2026-09-07T12:00:00.000Z"),
      description: "коммуналка",
    });
    await createManualExpense({
      propertyId: property.id,
      amount: 2580,
      category: "PLATFORM_COMMISSION",
      occurredAt: new Date("2026-09-08T12:00:00.000Z"),
      description: "комиссия площадки",
    });

    const dash = await getFinanceDashboard(RANGE);
    assert.equal(dash.summary.totalExpenses, 11830);
    assert.equal(dash.expenseDirections.unallocated, 11830);
    assert.equal(dash.expenseDirections.general, 0);
    assert.equal(dash.expensesByDirection.length, 1);
    assert.equal(sliceFor(dash, "UNALLOCATED")?.amount, 11830);
    assert.equal(sliceFor(dash, "UNALLOCATED")?.percent, 100);
    assertReconciles(dash);
  });

  it("only SHORT_TERM: booking-linked operator expense", async () => {
    const { channel, property } = await resetFixtures();
    const booking = await createBooking(property.id, channel.id, 5000);
    await createFinancialTransaction({
      propertyId: property.id,
      bookingId: booking.id,
      type: "EXPENSE",
      category: "CLEANING",
      amount: 1500,
      economicRole: "BUSINESS_EXPENSE",
      occurredAt: new Date("2026-09-06T12:00:00.000Z"),
      description: "уборка после гостя",
      sourceType: "MANUAL",
    });

    const dash = await getFinanceDashboard(RANGE);
    assert.equal(dash.expenseDirections.shortTerm, 1500);
    assert.equal(sliceFor(dash, "SHORT_TERM")?.amount, 1500);
    assertReconciles(dash);
  });

  it("only LONG_TERM: contract-linked operator expense", async () => {
    const { property } = await resetFixtures();
    const guest = await prisma.guest.create({ data: { firstName: "L", lastName: "T" } });
    const listing = await prisma.longTermListing.create({
      data: {
        propertyId: property.id,
        status: "ACTIVE",
        monthlyPrice: 50000,
        deposit: 50000,
      },
    });
    const contract = await prisma.longTermContract.create({
      data: {
        propertyId: property.id,
        longTermListingId: listing.id,
        guestId: guest.id,
        status: "ACTIVE",
        monthlyRent: 50000,
        depositAmount: 50000,
        commissionRateBps: 0,
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        paymentDay: 5,
      },
    });
    await createFinancialTransaction({
      propertyId: property.id,
      longTermContractId: contract.id,
      type: "EXPENSE",
      category: "REPAIR",
      amount: 2200,
      economicRole: "BUSINESS_EXPENSE",
      occurredAt: new Date("2026-09-10T12:00:00.000Z"),
      description: "ремонт по договору",
      sourceType: "MANUAL",
    });

    const dash = await getFinanceDashboard(RANGE);
    assert.equal(dash.expenseDirections.longTerm, 2200);
    assert.equal(sliceFor(dash, "LONG_TERM")?.amount, 2200);
    assertReconciles(dash);
  });

  it("mixed directions: all non-zero sectors present and reconcile", async () => {
    const { property } = await resetFixtures();
    await createManualExpense({
      propertyId: null,
      amount: 1000,
      category: "ADVERTISING",
      occurredAt: new Date("2026-09-06T12:00:00.000Z"),
      description: "общая",
    });
    await createManualExpense({
      propertyId: property.id,
      amount: 3000,
      category: "CLEANING",
      occurredAt: new Date("2026-09-07T12:00:00.000Z"),
      description: "уборка",
    });

    const dash = await getFinanceDashboard(RANGE);
    assert.equal(dash.expenseDirections.general, 1000);
    assert.equal(dash.expenseDirections.unallocated, 3000);
    assert.equal(dash.expensesByDirection.length, 2);
    assertReconciles(dash);
  });

  it("no expenses: empty distribution and zero total", async () => {
    await resetFixtures();
    const dash = await getFinanceDashboard(RANGE);
    assert.equal(dash.summary.totalExpenses, 0);
    assert.equal(dash.expenseDirections.total, 0);
    assert.equal(dash.expensesByDirection.length, 0);
  });
});
