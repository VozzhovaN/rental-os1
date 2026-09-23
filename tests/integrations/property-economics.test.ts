import "./helpers-preload";
import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import { GET as getEconomics } from "@/app/api/properties/[id]/economics/route";
import { GET as getBookingCommission } from "@/app/api/bookings/[id]/commission/route";
import { POST as postCommissionPayment } from "@/app/api/commission-payments/route";
import { GET as getSummary } from "@/app/api/finance/summary/route";
import { API_ROUTE_REGISTRY } from "@/lib/auth/api-registry";
import { classifyApiPath, ROUTE_ACCESS } from "@/lib/auth/route-access";
import {
  calculateBusinessEconomics,
  calculatePropertyEconomics,
  createCommissionPayment,
  createCommissionPaymentSchema,
  createManualExpense,
  ensureCommissionSnapshot,
  getFinanceSummary,
  recordBookingPayment,
  FinanceDomainError,
} from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";
import { authedRequest, createTestSessionCookie } from "../helpers/auth";

async function createProperty(opts: {
  managementType: "OWN" | "COMMISSION";
  rentCollectionMode?: "OPERATOR" | "OWNER_DIRECT";
  commissionDaily?: number;
}) {
  return prisma.property.create({
    data: {
      name: `Econ ${opts.managementType}`,
      slug: `econ-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: "APARTMENT",
      status: "ACTIVE",
      address: "ул. 1",
      city: "Тест",
      district: "А",
      area: 40,
      rooms: 1,
      bedrooms: 1,
      bathrooms: 1,
      guests: 2,
      description: "x",
      shortDescription: "x",
      ownerName: "Owner",
      ownerPhone: "+7",
      managementType: opts.managementType,
      rentCollectionMode: opts.rentCollectionMode ?? "OPERATOR",
      commissionDaily: opts.commissionDaily ?? 20,
    },
  });
}

async function createBooking(propertyId: string, channelId: string, totalAmount: number) {
  const guest = await prisma.guest.create({
    data: { firstName: "Eco", lastName: "Test" },
  });
  return prisma.booking.create({
    data: {
      propertyId,
      guestId: guest.id,
      salesChannelId: channelId,
      checkIn: new Date("2026-09-10T14:00:00.000Z"),
      checkOut: new Date("2026-09-12T12:00:00.000Z"),
      guestsCount: 1,
      totalAmount,
      status: "CONFIRMED",
    },
  });
}

describe("property economics (stage 12.4)", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  afterEach(async () => {
    await resetFixtures();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  it("OWN: rent payment posts BUSINESS_REVENUE; businessRevenue = net paid", async () => {
    const { channel } = await resetFixtures();
    const property = await createProperty({ managementType: "OWN" });
    const booking = await createBooking(property.id, channel.id, 10000);

    await recordBookingPayment(booking.id, {
      amount: 10000,
      paidAt: new Date("2026-09-01T12:00:00.000Z"),
      method: null,
      note: null,
    });

    const tx = await prisma.financialTransaction.findFirst({
      where: { bookingId: booking.id },
    });
    assert.ok(tx);
    assert.equal(tx.economicRole, "BUSINESS_REVENUE");

    const econ = await calculatePropertyEconomics(property.id);
    assert.equal(econ.ownRentalRevenue, 10000);
    assert.equal(econ.businessRevenue, 10000);
    assert.equal(econ.commissionAccrued, 0);
  });

  it("COMMISSION OPERATOR: rent is PASS_THROUGH; businessRevenue from CommissionPayment", async () => {
    const { channel } = await resetFixtures();
    const property = await createProperty({ managementType: "COMMISSION", rentCollectionMode: "OPERATOR" });
    const booking = await createBooking(property.id, channel.id, 10000);
    await ensureCommissionSnapshot(booking.id);

    await recordBookingPayment(booking.id, {
      amount: 10000,
      paidAt: new Date("2026-09-01T12:00:00.000Z"),
      method: null,
      note: null,
    });

    const tx = await prisma.financialTransaction.findFirst({
      where: { bookingId: booking.id, category: "RENT_PAYMENT" },
    });
    assert.ok(tx);
    assert.equal(tx.economicRole, "PASS_THROUGH");

    let econ = await calculatePropertyEconomics(property.id);
    assert.equal(econ.grossRent, 10000);
    assert.equal(econ.businessRevenue, 0);
    assert.equal(econ.commissionAccrued, 2000);

    await createCommissionPayment({
      propertyId: property.id,
      bookingId: booking.id,
      amount: 2000,
      paidAt: new Date("2026-09-05T12:00:00.000Z"),
      method: null,
      note: null,
    });

    econ = await calculatePropertyEconomics(property.id);
    assert.equal(econ.businessRevenue, 2000);
    assert.equal(econ.commissionReceived, 2000);
    assert.equal(econ.commissionReceivable, 0);
  });

  it("COMMISSION OWNER_DIRECT: no rent ledger; cash summary incomeTotal excludes guest rent", async () => {
    const { channel } = await resetFixtures();
    const property = await createProperty({
      managementType: "COMMISSION",
      rentCollectionMode: "OWNER_DIRECT",
    });
    const booking = await createBooking(property.id, channel.id, 8000);
    await ensureCommissionSnapshot(booking.id);

    await recordBookingPayment(booking.id, {
      amount: 8000,
      paidAt: new Date("2026-09-01T12:00:00.000Z"),
      method: null,
      note: null,
    });

    const txs = await prisma.financialTransaction.findMany({
      where: { bookingId: booking.id },
    });
    assert.equal(txs.length, 0);

    const summary = await getFinanceSummary({ propertyId: property.id });
    assert.equal(summary.incomeTotal, 0);
    assert.equal(summary.grossRent, 8000);

    await createCommissionPayment({
      propertyId: property.id,
      bookingId: booking.id,
      amount: 1600,
      paidAt: new Date("2026-09-02T12:00:00.000Z"),
      method: null,
      note: null,
    });

    const summary2 = await getFinanceSummary({ propertyId: property.id });
    assert.equal(summary2.incomeTotal, 1600);
    assert.equal(summary2.businessRevenue, 1600);
  });

  it("operator expenses reduce netProfit; global expense included in business aggregate", async () => {
    const { channel, property } = await resetFixtures();
    const booking = await createBooking(property.id, channel.id, 5000);
    await recordBookingPayment(booking.id, {
      amount: 5000,
      paidAt: new Date("2026-09-01T12:00:00.000Z"),
      method: null,
      note: null,
    });

    await createManualExpense({
      propertyId: property.id,
      amount: 1000,
      category: "CLEANING",
      occurredAt: new Date("2026-09-02T12:00:00.000Z"),
      description: "уборка",
    });
    await createManualExpense({
      propertyId: null,
      amount: 500,
      category: "ADVERTISING",
      occurredAt: new Date("2026-09-03T12:00:00.000Z"),
      description: "реклама",
    });

    const econ = await calculatePropertyEconomics(property.id);
    assert.equal(econ.businessRevenue, 5000);
    assert.equal(econ.totalExpenses, 1000);
    assert.equal(econ.netProfit, 4000);

    const business = await calculateBusinessEconomics();
    assert.ok(business.totalOperatorExpenses >= 1500);
    assert.equal(business.netProfit, business.businessRevenue - business.totalOperatorExpenses);
  });

  it("commission payment schema enforces XOR bookingId / longTermContractId", () => {
    assert.equal(
      createCommissionPaymentSchema.safeParse({
        propertyId: "p1",
        amount: 100,
        paidAt: "2026-09-01",
      }).success,
      false,
    );
    assert.equal(
      createCommissionPaymentSchema.safeParse({
        propertyId: "p1",
        amount: 100,
        paidAt: "2026-09-01",
        bookingId: "b1",
        longTermContractId: "c1",
      }).success,
      false,
    );
  });

  it("rejects commission payment on OWN property", async () => {
    const { channel } = await resetFixtures();
    const property = await createProperty({ managementType: "OWN" });
    const booking = await createBooking(property.id, channel.id, 1000);

    await assert.rejects(
      () =>
        createCommissionPayment({
          propertyId: property.id,
          bookingId: booking.id,
          amount: 100,
          paidAt: new Date("2026-09-01T12:00:00.000Z"),
          method: null,
          note: null,
        }),
      FinanceDomainError,
    );
  });

  it("API routes registered AUTH_REQUIRED; economics and commission endpoints work", async () => {
    const { channel } = await resetFixtures();
    const property = await createProperty({ managementType: "COMMISSION" });
    const booking = await createBooking(property.id, channel.id, 10000);
    await ensureCommissionSnapshot(booking.id);
    await recordBookingPayment(booking.id, {
      amount: 10000,
      paidAt: new Date("2026-09-01T12:00:00.000Z"),
      method: null,
      note: null,
    });

    for (const path of [
      "/api/commission-payments",
      "/api/properties/x/economics",
      "/api/bookings/x/commission",
      "/api/long-term-contracts/x/commission",
    ]) {
      assert.equal(classifyApiPath(path), ROUTE_ACCESS.AUTH_REQUIRED);
    }

    assert.ok(API_ROUTE_REGISTRY.some((r) => r.pathPattern === "/api/commission-payments"));
    assert.ok(API_ROUTE_REGISTRY.some((r) => r.pathPattern === "/api/properties/[id]/economics"));

    const { cookie } = await createTestSessionCookie();

    const unauth = await getEconomics(
      new Request(`http://localhost/api/properties/${property.id}/economics`),
      { params: Promise.resolve({ id: property.id }) },
    );
    assert.equal(unauth.status, 401);

    const econRes = await getEconomics(
      authedRequest(`http://localhost/api/properties/${property.id}/economics`, cookie),
      { params: Promise.resolve({ id: property.id }) },
    );
    assert.equal(econRes.status, 200);
    assert.equal(econRes.headers.get("Cache-Control"), "no-store");
    const econBody = await econRes.json();
    assert.equal(econBody.economics.grossRent, 10000);

    const commRes = await getBookingCommission(
      authedRequest(`http://localhost/api/bookings/${booking.id}/commission`, cookie),
      { params: Promise.resolve({ id: booking.id }) },
    );
    assert.equal(commRes.status, 200);

    const payRes = await postCommissionPayment(
      authedRequest("http://localhost/api/commission-payments", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          bookingId: booking.id,
          amount: 2000,
          paidAt: "2026-09-05",
          commissionAccrued: 99999,
          netProfit: 1,
          managementType: "OWN",
        }),
      }),
    );
    // Extra client fields rejected by strict Zod OR ignored — must not trust them
    assert.ok(payRes.status === 201 || payRes.status === 400);
    if (payRes.status === 201) {
      const payBody = await payRes.json();
      assert.equal(payBody.payment.amount, 2000);
    } else {
      // strict schema rejected unknown keys — re-post clean
      const payRes2 = await postCommissionPayment(
        authedRequest("http://localhost/api/commission-payments", cookie, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: property.id,
            bookingId: booking.id,
            amount: 2000,
            paidAt: "2026-09-05",
          }),
        }),
      );
      assert.equal(payRes2.status, 201);
    }

    const summaryRes = await getSummary(
      authedRequest("http://localhost/api/finance/summary", cookie),
    );
    assert.equal(summaryRes.status, 200);
    const summaryBody = await summaryRes.json();
    assert.ok(typeof summaryBody.summary.businessRevenue === "number");
    assert.ok(typeof summaryBody.summary.netProfit === "number");
  });

  it("commission snapshot locked; overpayment tracked; refund reduces OWN revenue & COMMISSION accrued", async () => {
    const { channel } = await resetFixtures();
    const property = await createProperty({
      managementType: "COMMISSION",
      rentCollectionMode: "OWNER_DIRECT",
      commissionDaily: 20,
    });
    const booking = await createBooking(property.id, channel.id, 10000);
    await ensureCommissionSnapshot(booking.id);
    await prisma.property.update({
      where: { id: property.id },
      data: { commissionDaily: 50 },
    });

    await recordBookingPayment(booking.id, {
      amount: 10000,
      paidAt: new Date("2026-09-01T12:00:00.000Z"),
      method: null,
      note: null,
    });
    let econ = await calculatePropertyEconomics(property.id);
    assert.equal(econ.commissionAccrued, 2000);

    await createCommissionPayment({
      propertyId: property.id,
      bookingId: booking.id,
      amount: 2500,
      paidAt: new Date("2026-09-02T12:00:00.000Z"),
      method: null,
      note: null,
    });
    econ = await calculatePropertyEconomics(property.id);
    assert.equal(econ.commissionReceived, 2500);
    assert.equal(econ.commissionOverpayment, 500);
    assert.equal(econ.commissionReceivable, 0);

    const txs = await prisma.financialTransaction.findMany({
      where: { category: "OPERATOR_COMMISSION", propertyId: property.id },
    });
    assert.equal(txs.length, 1);
    await createCommissionPayment({
      propertyId: property.id,
      bookingId: booking.id,
      amount: 100,
      paidAt: new Date("2026-09-03T12:00:00.000Z"),
      method: null,
      note: null,
    });
    assert.equal(
      await prisma.financialTransaction.count({
        where: { category: "OPERATOR_COMMISSION", propertyId: property.id },
      }),
      2,
    );

    // OWN refund
    const own = await createProperty({ managementType: "OWN" });
    const ownBooking = await createBooking(own.id, channel.id, 5000);
    await recordBookingPayment(ownBooking.id, {
      amount: 5000,
      paidAt: new Date("2026-09-01T12:00:00.000Z"),
      method: null,
      note: null,
    });
    const { recordBookingRefund } = await import("@/lib/finance/booking-finance");
    const payment = await prisma.bookingPayment.findFirstOrThrow({
      where: { bookingId: ownBooking.id },
    });
    await recordBookingRefund(ownBooking.id, payment.id, {
      amount: 1000,
      refundedAt: new Date("2026-09-02T12:00:00.000Z"),
      note: "частичный возврат",
    });
    const ownEcon = await calculatePropertyEconomics(own.id);
    assert.equal(ownEcon.ownRentalRevenue, 4000);
    assert.equal(ownEcon.businessRevenue, 4000);
  });

  it("long-term COMMISSION: deposit excluded; rent accrued != business revenue; LT snapshot", async () => {
    const { channel } = await resetFixtures();
    void channel;
    const property = await createProperty({
      managementType: "COMMISSION",
      rentCollectionMode: "OWNER_DIRECT",
      commissionDaily: 20,
    });
    await prisma.property.update({
      where: { id: property.id },
      data: { commissionMonthly: 20 },
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
    const guest = await prisma.guest.create({ data: { firstName: "L", lastName: "T" } });
    const {
      createLongTermContract,
      generateLongTermCharges,
      recordLongTermPayment,
    } = await import("@/lib/finance/long-term-finance");
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
    assert.equal(contract.commissionRateBps, 2000);
    await generateLongTermCharges(contract.id, {
      fromMonth: "2026-10",
      toMonth: "2026-10",
      includeDeposit: true,
    });
    await prisma.property.update({
      where: { id: property.id },
      data: { commissionMonthly: 40 },
    });

    const deposit = await prisma.longTermCharge.findFirstOrThrow({
      where: { contractId: contract.id, type: "DEPOSIT" },
    });
    await recordLongTermPayment(contract.id, {
      amount: 50000,
      paidAt: new Date("2026-10-02T12:00:00.000Z"),
      method: null,
      note: null,
      allocations: [{ chargeId: deposit.id, amount: 50000 }],
    });
    let econ = await calculatePropertyEconomics(property.id);
    assert.equal(econ.grossRent, 0);
    assert.equal(econ.commissionAccrued, 0);
    assert.equal(econ.businessRevenue, 0);
    assert.equal(
      await prisma.financialTransaction.count({
        where: { longTermContractId: contract.id, category: "RENT_PAYMENT" },
      }),
      0,
    );

    const rent = await prisma.longTermCharge.findFirstOrThrow({
      where: { contractId: contract.id, type: "RENT" },
    });
    await recordLongTermPayment(contract.id, {
      amount: 50000,
      paidAt: new Date("2026-10-05T12:00:00.000Z"),
      method: null,
      note: null,
      allocations: [{ chargeId: rent.id, amount: 50000 }],
    });
    // OWNER_DIRECT → no rent FT
    assert.equal(
      await prisma.financialTransaction.count({
        where: { longTermContractId: contract.id, category: "RENT_PAYMENT" },
      }),
      0,
    );
    econ = await calculatePropertyEconomics(property.id);
    assert.equal(econ.grossRent, 50000);
    assert.equal(econ.commissionAccrued, 10000);
    assert.equal(econ.businessRevenue, 0);

    await createCommissionPayment({
      propertyId: property.id,
      longTermContractId: contract.id,
      amount: 10000,
      paidAt: new Date("2026-10-06T12:00:00.000Z"),
      method: null,
      note: null,
    });
    econ = await calculatePropertyEconomics(property.id);
    assert.equal(econ.businessRevenue, 10000);
    assert.equal(econ.commissionReceivable, 0);
  });
});
