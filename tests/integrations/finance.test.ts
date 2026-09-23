import "./helpers-preload";
import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import { GET as getTransactions } from "@/app/api/finance/transactions/route";
import { GET as getSummary } from "@/app/api/finance/summary/route";
import { POST as postExpense } from "@/app/api/finance/expenses/route";
import { POST as postAdjustment } from "@/app/api/finance/adjustments/route";
import {
  API_ROUTE_REGISTRY,
} from "@/lib/auth/api-registry";
import { assertTrustedOrigin } from "@/lib/auth/csrf";
import { getAppOrigin } from "@/lib/auth/env";
import { classifyApiPath, ROUTE_ACCESS } from "@/lib/auth/route-access";
import {
  FinanceDomainError,
  assertPositiveMoney,
  bookingFinanceSourceKey,
  createExpenseSchema,
  createAdjustmentSchema,
  createFinancialTransaction,
  createManualExpense,
  createManualAdjustment,
  deleteFinancialTransaction,
  getFinanceSummary,
  listFinancialTransactions,
  sumMoney,
  FINANCIAL_CURRENCY_RUB,
} from "@/lib/finance";
import { formatMoney } from "@/lib/property-labels";
import { prisma } from "@/lib/prisma";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";
import { authedRequest, createTestSessionCookie } from "../helpers/auth";

describe("financial core (stage 12.1)", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  afterEach(async () => {
    await resetFixtures();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  it("exact money representation: integer RUB major units, not float", () => {
    assert.equal(FINANCIAL_CURRENCY_RUB, "RUB");
    assertPositiveMoney(35000);
    assert.throws(() => assertPositiveMoney(0.1), FinanceDomainError);
    assert.throws(() => assertPositiveMoney(1.5), FinanceDomainError);
    assert.throws(() => assertPositiveMoney(0), FinanceDomainError);
    assert.throws(() => assertPositiveMoney(-10), FinanceDomainError);
    // Classic float trap cannot appear in domain sum of integers
    const total = sumMoney([0.1, 0.2].map(() => 1)); // only integers allowed
    assert.equal(total, 2);
    assert.throws(() => sumMoney([0.1, 0.2]), FinanceDomainError);
  });

  it("floating-point error impossible in domain calculations", () => {
    const a = 10;
    const b = 20;
    const c = 30;
    assert.equal(sumMoney([a, b, c]), 60);
    assert.equal(sumMoney([100, -40, -25]), 35);
    assert.notEqual(0.1 + 0.2, 0.3);
    assert.throws(() => sumMoney([0.1 + 0.2]), FinanceDomainError);
  });

  it("RUB currency semantics and display formatting", async () => {
    const { property } = await resetFixtures();
    const row = await createManualExpense({
      propertyId: property.id,
      amount: 35000,
      category: "CLEANING",
      occurredAt: new Date("2026-09-01T12:00:00.000Z"),
      description: null,
    });
    assert.equal(row.currency, "RUB");
    assert.match(formatMoney(35000), /^35\u00a0000\s₽$/);
  });

  it("manual expense creation", async () => {
    const { property } = await resetFixtures();
    const row = await createManualExpense({
      propertyId: property.id,
      amount: 1500,
      category: "SUPPLIES",
      occurredAt: new Date("2026-09-10T12:00:00.000Z"),
      description: "Губки",
    });
    assert.equal(row.type, "EXPENSE");
    assert.equal(row.category, "SUPPLIES");
    assert.equal(row.amount, 1500);
    assert.equal(row.sourceType, "MANUAL");
    assert.equal(row.sourceKey, null);
  });

  it("expense amount must be positive", async () => {
    const { property } = await resetFixtures();
    assert.equal(createExpenseSchema.safeParse({
      propertyId: property.id,
      amount: 0,
      category: "CLEANING",
      occurredAt: "2026-09-01",
    }).success, false);
    assert.equal(createExpenseSchema.safeParse({
      propertyId: property.id,
      amount: -5,
      category: "CLEANING",
      occurredAt: "2026-09-01",
    }).success, false);
    await assert.rejects(
      () =>
        createManualExpense({
          propertyId: property.id,
          amount: -1,
          category: "CLEANING",
          occurredAt: new Date("2026-09-01T12:00:00.000Z"),
          description: null,
        }),
      FinanceDomainError,
    );
  });

  it("invalid category rejected", () => {
    const parsed = createExpenseSchema.safeParse({
      propertyId: "x",
      amount: 100,
      category: "NOT_A_CATEGORY",
      occurredAt: "2026-09-01",
    });
    assert.equal(parsed.success, false);
  });

  it("unknown fields rejected", () => {
    assert.equal(
      createExpenseSchema.safeParse({
        propertyId: "x",
        amount: 100,
        category: "CLEANING",
        occurredAt: "2026-09-01",
        ownerShare: 50,
      }).success,
      false,
    );
    assert.equal(
      createAdjustmentSchema.safeParse({
        propertyId: "x",
        amount: 100,
        direction: "CREDIT",
        occurredAt: "2026-09-01",
        description: "fix",
        commissionPercent: 10,
      }).success,
      false,
    );
  });

  it("invalid property rejected", async () => {
    await assert.rejects(
      () =>
        createManualExpense({
          propertyId: "missing-property-id",
          amount: 100,
          category: "CLEANING",
          occurredAt: new Date("2026-09-01T12:00:00.000Z"),
          description: null,
        }),
      (err: unknown) =>
        err instanceof FinanceDomainError && err.code === "NOT_FOUND",
    );
  });

  it("adjustment requires reason", () => {
    assert.equal(
      createAdjustmentSchema.safeParse({
        propertyId: "x",
        amount: 100,
        direction: "CREDIT",
        occurredAt: "2026-09-01",
        description: "",
      }).success,
      false,
    );
    assert.equal(
      createAdjustmentSchema.safeParse({
        propertyId: "x",
        amount: 100,
        direction: "CREDIT",
        occurredAt: "2026-09-01",
      }).success,
      false,
    );
  });

  it("source identity idempotency + duplicate generated source prevented", async () => {
    const { property } = await resetFixtures();
    const bookingId = "booking-demo-1";
    const sourceKey = bookingFinanceSourceKey(bookingId, "RENT");
    assert.equal(sourceKey, `BOOKING:${bookingId}:RENT`);

    const first = await createFinancialTransaction({
      propertyId: property.id,
      type: "INCOME",
      category: "RENT_PAYMENT",
      amount: 10000,
      occurredAt: new Date("2026-09-05T12:00:00.000Z"),
      sourceType: "BOOKING",
      sourceId: bookingId,
      sourceKey,
    });
    assert.equal(first.sourceKey, sourceKey);

    await assert.rejects(
      () =>
        createFinancialTransaction({
          propertyId: property.id,
          type: "INCOME",
          category: "RENT_PAYMENT",
          amount: 10000,
          occurredAt: new Date("2026-09-05T12:00:00.000Z"),
          sourceType: "BOOKING",
          sourceId: bookingId,
          sourceKey,
        }),
      (err: unknown) =>
        err instanceof FinanceDomainError && err.code === "CONFLICT",
    );

    const count = await prisma.financialTransaction.count({
      where: { sourceKey },
    });
    assert.equal(count, 1);
  });

  it("ledger filtering by Property and date", async () => {
    const { property, channel } = await resetFixtures();
    const other = await prisma.property.create({
      data: {
        name: "Другой объект",
        slug: `other-${Date.now()}`,
        type: "APARTMENT",
        status: "ACTIVE",
        address: "ул. Другая, 2",
        city: "Тест",
        district: "Б",
        area: 30,
        rooms: 1,
        bedrooms: 1,
        bathrooms: 1,
        guests: 2,
        description: "x",
        shortDescription: "x",
        ownerName: "Owner",
        ownerPhone: "+7 000",
        managementType: "OWN",
      },
    });

    await createManualExpense({
      propertyId: property.id,
      amount: 100,
      category: "CLEANING",
      occurredAt: new Date("2026-08-01T12:00:00.000Z"),
      description: null,
    });
    await createManualExpense({
      propertyId: property.id,
      amount: 200,
      category: "LAUNDRY",
      occurredAt: new Date("2026-09-15T12:00:00.000Z"),
      description: null,
    });
    await createManualExpense({
      propertyId: other.id,
      amount: 300,
      category: "REPAIR",
      occurredAt: new Date("2026-09-15T12:00:00.000Z"),
      description: null,
    });

    const byProperty = await listFinancialTransactions({ propertyId: property.id });
    assert.equal(byProperty.length, 2);
    assert.ok(byProperty.every((t) => t.propertyId === property.id));

    const byDate = await listFinancialTransactions({
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
    });
    assert.equal(byDate.length, 2);
    assert.ok(byDate.every((t) => t.occurredAt.startsWith("2026-09")));

    void channel;
  });

  it("income / expense / owner payout / net cash aggregates exact", async () => {
    const { property } = await resetFixtures();

    await createFinancialTransaction({
      propertyId: property.id,
      type: "INCOME",
      category: "RENT_PAYMENT",
      amount: 10000,
      occurredAt: new Date("2026-09-01T12:00:00.000Z"),
      sourceType: "MANUAL",
    });
    await createManualExpense({
      propertyId: property.id,
      amount: 1500,
      category: "CLEANING",
      occurredAt: new Date("2026-09-02T12:00:00.000Z"),
      description: null,
    });
    await createFinancialTransaction({
      propertyId: property.id,
      type: "OWNER_PAYOUT",
      category: "OWNER_PAYOUT",
      amount: 7000,
      occurredAt: new Date("2026-09-03T12:00:00.000Z"),
      sourceType: "OWNER_SETTLEMENT",
    });
    await createManualAdjustment({
      propertyId: property.id,
      amount: 200,
      direction: "CREDIT",
      occurredAt: new Date("2026-09-04T12:00:00.000Z"),
      description: "Коррекция округления",
    });
    await createManualAdjustment({
      propertyId: property.id,
      amount: 50,
      direction: "DEBIT",
      occurredAt: new Date("2026-09-05T12:00:00.000Z"),
      description: "Списание",
    });

    const summary = await getFinanceSummary({ propertyId: property.id });
    assert.equal(summary.currency, "RUB");
    assert.equal(summary.incomeTotal, 10000);
    assert.equal(summary.expenseTotal, 1500);
    assert.equal(summary.ownerPayoutTotal, 7000);
    assert.equal(summary.adjustmentNet, 150); // +200 - 50
    // net = income - expense - ownerPayout + adjustmentNet
    assert.equal(summary.netCashMovement, 10000 - 1500 - 7000 + 150);
    assert.equal(summary.netCashMovement, 1650);
  });

  it("financial entry cannot be arbitrarily hard deleted", async () => {
    await assert.rejects(
      () => deleteFinancialTransaction("any-id"),
      (err: unknown) =>
        err instanceof FinanceDomainError && err.code === "FORBIDDEN",
    );
  });

  it("Booking deletion cannot cascade-delete finance", async () => {
    const { property, channel } = await resetFixtures();
    const guest = await prisma.guest.create({
      data: { firstName: "Гость", lastName: "Тест", phone: "+7 111" },
    });
    const booking = await prisma.booking.create({
      data: {
        propertyId: property.id,
        guestId: guest.id,
        salesChannelId: channel.id,
        checkIn: new Date("2026-09-10T14:00:00.000Z"),
        checkOut: new Date("2026-09-12T12:00:00.000Z"),
        guestsCount: 2,
        totalAmount: 8000,
        status: "CONFIRMED",
      },
    });

    const tx = await createFinancialTransaction({
      propertyId: property.id,
      bookingId: booking.id,
      type: "INCOME",
      category: "RENT_PAYMENT",
      amount: 8000,
      occurredAt: new Date("2026-09-10T12:00:00.000Z"),
      sourceType: "BOOKING",
      sourceId: booking.id,
      sourceKey: bookingFinanceSourceKey(booking.id, "RENT"),
    });

    await prisma.booking.delete({ where: { id: booking.id } });

    const kept = await prisma.financialTransaction.findUnique({
      where: { id: tx.id },
    });
    assert.ok(kept);
    assert.equal(kept.bookingId, null);
    assert.equal(kept.amount, 8000);
  });

  it("unauthenticated finance API → 401; no-store; CSRF rejects bad Origin", async () => {
    for (const response of [
      await getTransactions(new Request("http://localhost/api/finance/transactions")),
      await getSummary(new Request("http://localhost/api/finance/summary")),
      await postExpense(
        new Request("http://localhost/api/finance/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
      ),
      await postAdjustment(
        new Request("http://localhost/api/finance/adjustments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
      ),
    ]) {
      assert.equal(response.status, 401);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
    }

    const previousOrigin = process.env.APP_ORIGIN;
    process.env.APP_ORIGIN = "https://crm.example.com";
    try {
      assert.equal(getAppOrigin(), "https://crm.example.com");
      const bad = assertTrustedOrigin(
        new Request("http://localhost/api/finance/expenses", {
          method: "POST",
          headers: { origin: "https://evil.example" },
        }),
      );
      assert.equal(bad.ok, false);

      const { cookie } = await createTestSessionCookie();
      const { property } = await resetFixtures();
      const rejected = await postExpense(
        authedRequest("http://localhost/api/finance/expenses", cookie, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            origin: "https://evil.example",
          },
          body: JSON.stringify({
            propertyId: property.id,
            amount: 100,
            category: "CLEANING",
            occurredAt: "2026-09-01",
          }),
        }),
      );
      assert.equal(rejected.status, 403);
      assert.equal(rejected.headers.get("Cache-Control"), "no-store");
    } finally {
      process.env.APP_ORIGIN = previousOrigin || "http://localhost";
    }
  });

  it("authenticated expense + summary no-store; finance routes AUTH_REQUIRED; registry complete", async () => {
    const { cookie } = await createTestSessionCookie();
    const { property } = await resetFixtures();

    const created = await postExpense(
      authedRequest("http://localhost/api/finance/expenses", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          amount: 2500,
          category: "UTILITIES",
          occurredAt: "2026-09-20",
          description: "Свет",
        }),
      }),
    );
    assert.equal(created.status, 201);
    assert.equal(created.headers.get("Cache-Control"), "no-store");

    const list = await getTransactions(
      authedRequest(
        `http://localhost/api/finance/transactions?propertyId=${property.id}`,
        cookie,
      ),
    );
    assert.equal(list.status, 200);
    assert.equal(list.headers.get("Cache-Control"), "no-store");
    const listBody = await list.json();
    assert.equal(listBody.transactions.length, 1);

    const summary = await getSummary(
      authedRequest(
        `http://localhost/api/finance/summary?propertyId=${property.id}`,
        cookie,
      ),
    );
    assert.equal(summary.status, 200);
    assert.equal(summary.headers.get("Cache-Control"), "no-store");
    const summaryBody = await summary.json();
    assert.equal(summaryBody.summary.expenseTotal, 2500);

    for (const path of [
      "/api/finance/transactions",
      "/api/finance/expenses",
      "/api/finance/adjustments",
      "/api/finance/summary",
      "/api/finance/dashboard",
      "/api/finance/dashboard/drilldown",
    ]) {
      assert.equal(classifyApiPath(path), ROUTE_ACCESS.AUTH_REQUIRED);
    }

    const financeRoutes = API_ROUTE_REGISTRY.filter((r) =>
      r.pathPattern.startsWith("/api/finance"),
    );
    assert.ok(financeRoutes.length >= 6);
    assert.ok(financeRoutes.every((r) => r.access === ROUTE_ACCESS.AUTH_REQUIRED));
  });
});
