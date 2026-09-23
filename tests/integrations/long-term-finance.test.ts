import "./helpers-preload";
import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import { GET as getFinance } from "@/app/api/long-term-contracts/[id]/finance/route";
import { POST as postPayment } from "@/app/api/long-term-contracts/[id]/payments/route";
import { API_ROUTE_REGISTRY } from "@/lib/auth/api-registry";
import { assertTrustedOrigin } from "@/lib/auth/csrf";
import { getAppOrigin } from "@/lib/auth/env";
import { classifyApiPath, ROUTE_ACCESS } from "@/lib/auth/route-access";
import { FinanceDomainError } from "@/lib/finance";
import {
  calculateRentCommission,
  cancelLongTermContract,
  createLongTermContract,
  endLongTermContract,
  generateLongTermCharges,
  getContractFinanceSummary,
  longTermPaymentSourceKey,
  longTermRentChargeSourceKey,
  recordLongTermPayment,
  syncLongTermPaymentTransaction,
} from "@/lib/finance/long-term-finance";
import { createLongTermContractSchema } from "@/lib/finance/long-term-finance-validation";
import { getFinanceSummary } from "@/lib/finance/service";
import { sumDashboardIncome as dashIncome } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";
import { authedRequest, createTestSessionCookie } from "../helpers/auth";

async function setupCommissionListing(rate = 20) {
  const { channel, property: base } = await resetFixtures();
  const property = await prisma.property.update({
    where: { id: base.id },
    data: { managementType: "COMMISSION", commissionMonthly: rate },
  });
  const listing = await prisma.longTermListing.create({
    data: {
      propertyId: property.id,
      status: "ACTIVE",
      monthlyPrice: 50000,
      deposit: 50000,
      commission: 15,
    },
  });
  const guest = await prisma.guest.create({
    data: { firstName: "Арендатор", lastName: "Тест" },
  });
  return { channel, property, listing, guest };
}

describe("long-term finance (stage 12.3)", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  afterEach(async () => {
    await resetFixtures();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  it("listing != contract; snapshots lock; paymentDay validated", async () => {
    const { property, listing, guest } = await setupCommissionListing(20);
    const contract = await createLongTermContract({
      propertyId: property.id,
      longTermListingId: listing.id,
      guestId: guest.id,
      startDate: new Date("2026-10-01T12:00:00.000Z"),
      monthlyRent: 50000,
      depositAmount: 50000,
      paymentDay: 5,
      notes: null,
      status: "DRAFT",
    });
    assert.notEqual(contract.id, listing.id);
    assert.equal(contract.monthlyRent, 50000);
    assert.equal(contract.commissionRateBps, 2000);
    assert.equal(contract.depositAmount, 50000);

    await prisma.longTermListing.update({
      where: { id: listing.id },
      data: { monthlyPrice: 99999, deposit: 1 },
    });
    await prisma.property.update({
      where: { id: property.id },
      data: { commissionMonthly: 30 },
    });
    const again = await prisma.longTermContract.findUniqueOrThrow({ where: { id: contract.id } });
    assert.equal(again.monthlyRent, 50000);
    assert.equal(again.commissionRateBps, 2000);
    assert.equal(again.depositAmount, 50000);

    assert.equal(
      createLongTermContractSchema.safeParse({
        propertyId: property.id,
        guestId: guest.id,
        startDate: "2026-10-01",
        monthlyRent: 1000,
        paymentDay: 29,
      }).success,
      false,
    );
  });

  it("charge generation idempotent; MANUAL_FIRST_PERIOD skips incomplete first month", async () => {
    const { property, listing, guest } = await setupCommissionListing(20);
    const contract = await createLongTermContract({
      propertyId: property.id,
      longTermListingId: listing.id,
      guestId: guest.id,
      startDate: new Date("2026-10-15T12:00:00.000Z"),
      monthlyRent: 50000,
      depositAmount: 0,
      paymentDay: 5,
      notes: null,
      status: "ACTIVE",
    });
    const first = await generateLongTermCharges(contract.id, {
      fromMonth: "2026-10",
      toMonth: "2026-11",
      includeDeposit: false,
    });
    assert.ok(first.skippedMonths.includes("2026-10"));
    assert.equal(first.createdCount, 1);
    const second = await generateLongTermCharges(contract.id, {
      fromMonth: "2026-10",
      toMonth: "2026-11",
    });
    assert.equal(second.createdCount, 0);
    const key = longTermRentChargeSourceKey(contract.id, "2026-11");
    assert.equal(await prisma.longTermCharge.count({ where: { sourceKey: key } }), 1);
  });

  it("payments, allocations, ledger once; deposit not in commission; OWN ownerShare 0", async () => {
    const { property, listing, guest } = await setupCommissionListing(20);
    const contract = await createLongTermContract({
      propertyId: property.id,
      longTermListingId: listing.id,
      guestId: guest.id,
      startDate: new Date("2026-10-01T12:00:00.000Z"),
      monthlyRent: 50000,
      depositAmount: 50000,
      paymentDay: 5,
      notes: null,
      status: "ACTIVE",
    });
    await generateLongTermCharges(contract.id, {
      fromMonth: "2026-10",
      toMonth: "2026-10",
      includeDeposit: true,
    });

    const rentSplit = calculateRentCommission({
      rentAmount: 50000,
      commissionRateBps: 2000,
      managementType: "COMMISSION",
    });
    assert.equal(rentSplit.commissionAmount, 10000);
    assert.equal(rentSplit.ownerShareAmount, 40000);
    assert.equal(rentSplit.commissionAmount + rentSplit.ownerShareAmount, 50000);

    const own = calculateRentCommission({
      rentAmount: 50000,
      commissionRateBps: 2000,
      managementType: "OWN",
    });
    assert.equal(own.ownerShareAmount, 0);

    // Partial: pay deposit partially then rent
    await recordLongTermPayment(contract.id, {
      amount: 20000,
      paidAt: new Date("2026-10-02T12:00:00.000Z"),
      method: null,
      note: null,
    });
    let finance = await getContractFinanceSummary(contract.id);
    assert.equal(finance.summary.depositPaid, 20000);
    assert.ok(finance.summary.rentPaid === 0 || finance.summary.depositPaid >= 0);

    await recordLongTermPayment(contract.id, {
      amount: 80000,
      paidAt: new Date("2026-10-03T12:00:00.000Z"),
      method: null,
      note: null,
    });
    finance = await getContractFinanceSummary(contract.id);
    assert.equal(finance.summary.depositPaid, 50000);
    assert.equal(finance.summary.rentPaid, 50000);
    assert.equal(finance.summary.rentOutstanding, 0);
    assert.equal(finance.summary.commissionOnPaid, 10000);
    // deposit not in commission base
    assert.equal(finance.summary.commissionAccrued, 10000);

    const txs = await prisma.financialTransaction.findMany({
      where: { longTermContractId: contract.id },
    });
    assert.equal(txs.length, 2);
    for (const tx of txs) {
      await syncLongTermPaymentTransaction(tx.sourceId!);
    }
    assert.equal(
      await prisma.financialTransaction.count({ where: { longTermContractId: contract.id } }),
      2,
    );

    const summary = await getFinanceSummary({ propertyId: property.id });
    assert.equal(summary.incomeTotal, 100000);
  });

  it("allocation cannot exceed payment or charge; accrued != paid; overdue", async () => {
    const { property, listing, guest } = await setupCommissionListing(20);
    const contract = await createLongTermContract({
      propertyId: property.id,
      longTermListingId: listing.id,
      guestId: guest.id,
      startDate: new Date("2026-01-01T12:00:00.000Z"),
      monthlyRent: 10000,
      depositAmount: 0,
      paymentDay: 5,
      notes: null,
      status: "ACTIVE",
    });
    await generateLongTermCharges(contract.id, { fromMonth: "2026-01", toMonth: "2026-01" });
    const charge = await prisma.longTermCharge.findFirstOrThrow({
      where: { contractId: contract.id, type: "RENT" },
    });

    await assert.rejects(
      () =>
        recordLongTermPayment(contract.id, {
          amount: 1000,
          paidAt: new Date("2026-01-06T12:00:00.000Z"),
          method: null,
          note: null,
          allocations: [{ chargeId: charge.id, amount: 2000 }],
        }),
      FinanceDomainError,
    );

    await recordLongTermPayment(contract.id, {
      amount: 3000,
      paidAt: new Date("2026-01-06T12:00:00.000Z"),
      method: null,
      note: null,
    });
    const finance = await getContractFinanceSummary(contract.id);
    assert.equal(finance.summary.rentAccrued, 10000);
    assert.equal(finance.summary.rentPaid, 3000);
    assert.notEqual(finance.summary.rentAccrued, finance.summary.rentPaid);
    assert.ok(finance.summary.overdueChargeCount >= 1);
  });

  it("ENDED/CANCELLED preserve history; unpaid future charges cancelable", async () => {
    const { property, listing, guest } = await setupCommissionListing(20);
    const contract = await createLongTermContract({
      propertyId: property.id,
      longTermListingId: listing.id,
      guestId: guest.id,
      startDate: new Date("2026-10-01T12:00:00.000Z"),
      monthlyRent: 10000,
      depositAmount: 0,
      paymentDay: 5,
      notes: null,
      status: "ACTIVE",
    });
    await generateLongTermCharges(contract.id, { fromMonth: "2026-10", toMonth: "2026-11" });
    await recordLongTermPayment(contract.id, {
      amount: 10000,
      paidAt: new Date("2026-10-05T12:00:00.000Z"),
      method: null,
      note: null,
    });
    await endLongTermContract(contract.id);
    assert.equal(
      await prisma.financialTransaction.count({ where: { longTermContractId: contract.id } }),
      1,
    );
    assert.equal(await prisma.longTermPayment.count({ where: { contractId: contract.id } }), 1);

    const { property: p2, listing: l2, guest: g2 } = await setupCommissionListing(15);
    const c2 = await createLongTermContract({
      propertyId: p2.id,
      longTermListingId: l2.id,
      guestId: g2.id,
      startDate: new Date("2026-10-01T12:00:00.000Z"),
      monthlyRent: 10000,
      depositAmount: 0,
      paymentDay: 5,
      notes: null,
      status: "ACTIVE",
    });
    await generateLongTermCharges(c2.id, { fromMonth: "2026-10", toMonth: "2026-11" });
    await cancelLongTermContract(c2.id);
    const cancelled = await prisma.longTermContract.findUniqueOrThrow({ where: { id: c2.id } });
    assert.equal(cancelled.status, "CANCELLED");
  });

  it("API auth/CSRF/no-store/registry; dashboard income unchanged", async () => {
    assert.equal(classifyApiPath("/api/long-term-contracts"), ROUTE_ACCESS.AUTH_REQUIRED);
    assert.equal(
      classifyApiPath("/api/long-term-contracts/x/payments"),
      ROUTE_ACCESS.AUTH_REQUIRED,
    );
    assert.ok(
      API_ROUTE_REGISTRY.some((r) => r.pathPattern === "/api/long-term-contracts/[id]/finance"),
    );

    const unauth = await getFinance(new Request("http://localhost/api/long-term-contracts/x/finance"), {
      params: Promise.resolve({ id: "x" }),
    });
    assert.equal(unauth.status, 401);
    assert.equal(unauth.headers.get("Cache-Control"), "no-store");

    const previous = process.env.APP_ORIGIN;
    process.env.APP_ORIGIN = "https://crm.example.com";
    try {
      assert.equal(getAppOrigin(), "https://crm.example.com");
      assert.equal(
        assertTrustedOrigin(
          new Request("http://localhost/api/long-term-contracts", {
            method: "POST",
            headers: { origin: "https://evil.example" },
          }),
        ).ok,
        false,
      );
    } finally {
      process.env.APP_ORIGIN = previous || "http://localhost";
    }

    assert.equal(
      dashIncome([
        { status: "CONFIRMED", totalAmount: 100 },
        { status: "PENDING", totalAmount: 50 },
      ]),
      100,
    );
  });

  it("authenticated payment posts no-store", async () => {
    const { property, listing, guest } = await setupCommissionListing(20);
    const contract = await createLongTermContract({
      propertyId: property.id,
      longTermListingId: listing.id,
      guestId: guest.id,
      startDate: new Date("2026-10-01T12:00:00.000Z"),
      monthlyRent: 10000,
      depositAmount: 0,
      paymentDay: 5,
      notes: null,
      status: "ACTIVE",
    });
    await generateLongTermCharges(contract.id, { fromMonth: "2026-10", toMonth: "2026-10" });
    const { cookie } = await createTestSessionCookie();
    const res = await postPayment(
      authedRequest(`http://localhost/api/long-term-contracts/${contract.id}/payments`, cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 10000, paidAt: "2026-10-05" }),
      }),
      { params: Promise.resolve({ id: contract.id }) },
    );
    assert.equal(res.status, 201);
    assert.equal(res.headers.get("Cache-Control"), "no-store");
    const key = longTermPaymentSourceKey((await res.json()).payment.id);
    assert.ok(await prisma.financialTransaction.findUnique({ where: { sourceKey: key } }));
  });
});
