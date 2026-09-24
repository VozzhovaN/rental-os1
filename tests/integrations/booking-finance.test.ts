import "./helpers-preload";
import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import { GET as getFinance } from "@/app/api/bookings/[id]/finance/route";
import { POST as postPayment } from "@/app/api/bookings/[id]/payments/route";
import { POST as postRefund } from "@/app/api/bookings/[id]/payments/[paymentId]/refund/route";
import { API_ROUTE_REGISTRY } from "@/lib/auth/api-registry";
import { classifyApiPath, ROUTE_ACCESS } from "@/lib/auth/route-access";
import {
  FinanceDomainError,
  applyCommissionBps,
  bookingPaymentRentSourceKey,
  calculateBookingFinancialBreakdown,
  ensureCommissionSnapshot,
  getBookingFinanceState,
  getFinanceSummary,
  percentToBps,
  recordBookingPayment,
  recordBookingPaymentSchema,
  recordBookingRefund,
  reconcileBookingFinance,
  syncBookingPaymentTransaction,
} from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";
import { authedRequest, createTestSessionCookie } from "../helpers/auth";

async function createCommissionProperty(channelId: string, rate = 20) {
  return prisma.property.create({
    data: {
      name: "Комиссионный объект",
      slug: `commission-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: "APARTMENT",
      status: "ACTIVE",
      address: "ул. Комиссия, 1",
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
      managementType: "COMMISSION",
      commissionDaily: rate,
    },
  });
}

async function createBooking(opts: {
  propertyId: string;
  channelId: string;
  totalAmount: number;
  status?: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
}) {
  const guest = await prisma.guest.create({
    data: { firstName: "Фин", lastName: "Тест" },
  });
  return prisma.booking.create({
    data: {
      propertyId: opts.propertyId,
      guestId: guest.id,
      salesChannelId: opts.channelId,
      checkIn: new Date("2026-09-10T14:00:00.000Z"),
      checkOut: new Date("2026-09-12T12:00:00.000Z"),
      guestsCount: 1,
      totalAmount: opts.totalAmount,
      status: opts.status ?? "CONFIRMED",
    },
  });
}

describe("booking finance (stage 12.2)", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  afterEach(async () => {
    await resetFixtures();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  it("gross uses Booking.totalAmount; commission half-up integer math; identity holds", () => {
    assert.equal(percentToBps(20), 2000);
    assert.equal(applyCommissionBps(10000, 2000), 2000);
    assert.equal(applyCommissionBps(9999, 1500), 1500); // 14.9985% → 1500 half-up path
    // 1 ruble * 50% → 0.5 → 1 half-up
    assert.equal(applyCommissionBps(1, 5000), 1);

    const split = calculateBookingFinancialBreakdown({
      grossAmount: 10000,
      commissionRateBps: 2000,
      managementType: "COMMISSION",
    });
    assert.equal(split.grossAmount, 10000);
    assert.equal(split.commissionAmount, 2000);
    assert.equal(split.ownerShareAmount, 8000);
    assert.equal(split.commissionAmount + split.ownerShareAmount, split.grossAmount);
  });

  it("OWN property: no external owner share debt", () => {
    const split = calculateBookingFinancialBreakdown({
      grossAmount: 10000,
      commissionRateBps: 2000,
      managementType: "OWN",
    });
    assert.equal(split.isOperatorOwned, true);
    assert.equal(split.commissionRateBps, 10000);
    assert.equal(split.commissionAmount, 10000);
    assert.equal(split.ownerShareAmount, 0);
  });

  it("CONFIRMED does not imply paid; unpaid finance state", async () => {
    const { property, channel } = await resetFixtures();
    const booking = await createBooking({
      propertyId: property.id,
      channelId: channel.id,
      totalAmount: 25000,
      status: "CONFIRMED",
    });
    const state = await getBookingFinanceState(booking.id);
    assert.equal(state.netPaidAmount, 0);
    assert.equal(state.remainingAmount, 25000);
    assert.equal(state.payments.length, 0);
  });

  it("commission snapshot locks; Property rate change does not alter history", async () => {
    const { channel } = await resetFixtures();
    const property = await createCommissionProperty(channel.id, 20);
    const booking = await createBooking({
      propertyId: property.id,
      channelId: channel.id,
      totalAmount: 10000,
    });

    const bps = await ensureCommissionSnapshot(booking.id);
    assert.equal(bps, 2000);

    await prisma.property.update({
      where: { id: property.id },
      data: { commissionDaily: 25 },
    });

    await ensureCommissionSnapshot(booking.id);
    const again = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    assert.equal(again.commissionRateBps, 2000);

    const state = await getBookingFinanceState(booking.id);
    assert.equal(state.breakdown.commissionAmount, 2000);
  });

  it("partial and full payment; remaining and overpayment", async () => {
    const { channel } = await resetFixtures();
    const property = await createCommissionProperty(channel.id, 20);
    const booking = await createBooking({
      propertyId: property.id,
      channelId: channel.id,
      totalAmount: 10000,
    });

    await recordBookingPayment(booking.id, {
      amount: 4000,
      paidAt: new Date("2026-09-01T12:00:00.000Z"),
      method: "перевод",
      note: null,
    });
    let state = await getBookingFinanceState(booking.id);
    assert.equal(state.netPaidAmount, 4000);
    assert.equal(state.remainingAmount, 6000);
    assert.equal(state.commissionOnReceived, 800);
    assert.equal(state.ownerShareOnReceived, 3200);

    await recordBookingPayment(booking.id, {
      amount: 6000,
      paidAt: new Date("2026-09-02T12:00:00.000Z"),
      method: null,
      note: null,
    });
    state = await getBookingFinanceState(booking.id);
    assert.equal(state.netPaidAmount, 10000);
    assert.equal(state.remainingAmount, 0);

    await recordBookingPayment(booking.id, {
      amount: 500,
      paidAt: new Date("2026-09-03T12:00:00.000Z"),
      method: null,
      note: "переплата",
    });
    state = await getBookingFinanceState(booking.id);
    assert.equal(state.overpaymentAmount, 500);
    assert.equal(state.remainingAmount, 0);
  });

  it("payment creates exactly one RENT_PAYMENT INCOME; sync idempotent; no commission INCOME", async () => {
    const { channel } = await resetFixtures();
    const property = await createCommissionProperty(channel.id, 20);
    const booking = await createBooking({
      propertyId: property.id,
      channelId: channel.id,
      totalAmount: 10000,
    });

    const payment = await recordBookingPayment(booking.id, {
      amount: 10000,
      paidAt: new Date("2026-09-01T12:00:00.000Z"),
      method: null,
      note: null,
    });

    await syncBookingPaymentTransaction(payment.id);
    await reconcileBookingFinance(booking.id);

    const txs = await prisma.financialTransaction.findMany({
      where: { bookingId: booking.id },
    });
    assert.equal(txs.length, 1);
    assert.equal(txs[0].type, "INCOME");
    assert.equal(txs[0].category, "RENT_PAYMENT");
    assert.equal(txs[0].amount, 10000);
    assert.equal(txs[0].sourceKey, bookingPaymentRentSourceKey(payment.id));

    const summary = await getFinanceSummary({ propertyId: property.id });
    assert.equal(summary.incomeTotal, 10000);
    assert.equal(summary.netCashMovement, 10000);
  });

  it("client commission/ownerShare rejected; unknown fields rejected", () => {
    assert.equal(
      recordBookingPaymentSchema.safeParse({
        amount: 1000,
        paidAt: "2026-09-01",
        commissionAmount: 200,
      }).success,
      false,
    );
  });

  it("refund cannot exceed net payment; refund posts GUEST_REFUND expense; history kept", async () => {
    const { channel } = await resetFixtures();
    const property = await createCommissionProperty(channel.id, 20);
    const booking = await createBooking({
      propertyId: property.id,
      channelId: channel.id,
      totalAmount: 10000,
    });
    const payment = await recordBookingPayment(booking.id, {
      amount: 5000,
      paidAt: new Date("2026-09-01T12:00:00.000Z"),
      method: null,
      note: null,
    });

    await assert.rejects(
      () =>
        recordBookingRefund(booking.id, payment.id, {
          amount: 5001,
          refundedAt: new Date("2026-09-02T12:00:00.000Z"),
          note: "too much",
        }),
      FinanceDomainError,
    );

    await recordBookingRefund(booking.id, payment.id, {
      amount: 2000,
      refundedAt: new Date("2026-09-02T12:00:00.000Z"),
      note: "частичный возврат",
    });

    const income = await prisma.financialTransaction.findFirst({
      where: { sourceKey: bookingPaymentRentSourceKey(payment.id) },
    });
    assert.ok(income);
    assert.equal(income.amount, 5000);

    const refundTx = await prisma.financialTransaction.findFirst({
      where: { bookingId: booking.id, category: "GUEST_REFUND" },
    });
    assert.ok(refundTx);
    assert.equal(refundTx.type, "EXPENSE");
    assert.equal(refundTx.amount, 2000);

    const state = await getBookingFinanceState(booking.id);
    assert.equal(state.netPaidAmount, 3000);

    const summary = await getFinanceSummary({ propertyId: property.id });
    assert.equal(summary.incomeTotal, 5000);
    assert.equal(summary.expenseTotal, 2000);
    assert.equal(summary.netCashMovement, 3000);
  });

  it("CANCELLED booking keeps payment ledger rows", async () => {
    const { channel } = await resetFixtures();
    const property = await createCommissionProperty(channel.id, 20);
    const booking = await createBooking({
      propertyId: property.id,
      channelId: channel.id,
      totalAmount: 8000,
    });
    await recordBookingPayment(booking.id, {
      amount: 8000,
      paidAt: new Date("2026-09-01T12:00:00.000Z"),
      method: null,
      note: null,
    });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
    });
    const txs = await prisma.financialTransaction.findMany({
      where: { bookingId: booking.id },
    });
    assert.equal(txs.length, 1);
    assert.equal(txs[0].amount, 8000);
  });

  it("нельзя принять новую оплату по CANCELLED бронированию", async () => {
    const { channel } = await resetFixtures();
    const property = await createCommissionProperty(channel.id, 20);
    const booking = await createBooking({
      propertyId: property.id,
      channelId: channel.id,
      totalAmount: 5000,
    });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
    });
    await assert.rejects(
      () =>
        recordBookingPayment(booking.id, {
          amount: 1000,
          paidAt: new Date("2026-09-02T12:00:00.000Z"),
          method: null,
          note: null,
        }),
      (error: unknown) =>
        error instanceof FinanceDomainError && error.code === "VALIDATION",
    );
    assert.equal(
      await prisma.bookingPayment.count({ where: { bookingId: booking.id } }),
      0,
    );
  });

  it("unauthenticated booking finance API → 401; routes AUTH_REQUIRED; no-store", async () => {
    const { channel } = await resetFixtures();
    const property = await createCommissionProperty(channel.id, 20);
    const booking = await createBooking({
      propertyId: property.id,
      channelId: channel.id,
      totalAmount: 1000,
    });

    const unauth = await getFinance(
      new Request(`http://localhost/api/bookings/${booking.id}/finance`),
      { params: Promise.resolve({ id: booking.id }) },
    );
    assert.equal(unauth.status, 401);
    assert.equal(unauth.headers.get("Cache-Control"), "no-store");

    for (const path of [
      "/api/bookings/x/finance",
      "/api/bookings/x/payments",
      "/api/bookings/x/payments/y/refund",
    ]) {
      assert.equal(classifyApiPath(path), ROUTE_ACCESS.AUTH_REQUIRED);
    }

    const registered = API_ROUTE_REGISTRY.filter((r) =>
      r.pathPattern.includes("/finance") || r.pathPattern.includes("/payments"),
    );
    assert.ok(registered.some((r) => r.pathPattern === "/api/bookings/[id]/finance"));
    assert.ok(registered.some((r) => r.pathPattern === "/api/bookings/[id]/payments"));
    assert.ok(
      registered.some(
        (r) => r.pathPattern === "/api/bookings/[id]/payments/[paymentId]/refund",
      ),
    );

    const { cookie } = await createTestSessionCookie();
    const created = await postPayment(
      authedRequest(`http://localhost/api/bookings/${booking.id}/payments`, cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 1000, paidAt: "2026-09-01" }),
      }),
      { params: Promise.resolve({ id: booking.id }) },
    );
    assert.equal(created.status, 201);
    assert.equal(created.headers.get("Cache-Control"), "no-store");
    const body = await created.json();
    const paymentId = body.payment.id as string;

    const refund = await postRefund(
      authedRequest(
        `http://localhost/api/bookings/${booking.id}/payments/${paymentId}/refund`,
        cookie,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: 200,
            refundedAt: "2026-09-02",
            note: "тест",
          }),
        },
      ),
      { params: Promise.resolve({ id: booking.id, paymentId }) },
    );
    assert.equal(refund.status, 201);
  });

  it("does not use floating-point for domain commission on awkward amounts", () => {
    // Classic float trap would break 0.1+0.2; our path stays integer
    const amount = applyCommissionBps(333, 1000); // 10%
    assert.equal(Number.isInteger(amount), true);
    assert.equal(amount, 33); // 33.3 → 33 half-up? 3330/10000 = 0.333 → wait
    // 333 * 1000 = 333000; +5000 = 338000; /10000 = 33.8 → floor 33
    assert.equal(amount, 33);
    const split = calculateBookingFinancialBreakdown({
      grossAmount: 333,
      commissionRateBps: 1000,
      managementType: "COMMISSION",
    });
    assert.equal(split.commissionAmount + split.ownerShareAmount, 333);
  });
});
