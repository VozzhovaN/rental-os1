import "./helpers-preload";
import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import { GET as getOwners, POST as postOwner } from "@/app/api/owners/route";
import { GET as getOwnerFinance } from "@/app/api/owners/[id]/finance/route";
import { API_ROUTE_REGISTRY } from "@/lib/auth/api-registry";
import { assertTrustedOrigin } from "@/lib/auth/csrf";
import { getAppOrigin } from "@/lib/auth/env";
import { classifyApiPath, ROUTE_ACCESS } from "@/lib/auth/route-access";
import {
  FinanceDomainError,
  balanceAsOf,
  calculateOwnerBalance,
  createAdjustmentSchema,
  createManualExpense,
  createOwner,
  createOwnerPayout,
  createOwnerPayoutSchema,
  createOwnerSchema,
  deleteOwnerHard,
  ownerPayoutSourceKey,
  periodActivity,
  syncOwnerPayoutTransaction,
  updateOwner,
} from "@/lib/finance";
import {
  ensureCommissionSnapshot,
  recordBookingPayment,
  recordBookingRefund,
} from "@/lib/finance/booking-finance";
import {
  createLongTermContract,
  generateLongTermCharges,
  recordLongTermPayment,
} from "@/lib/finance/long-term-finance";
import { createProperty } from "@/lib/properties";
import {
  mapToCianFlatRentPayload,
  serializeCianFeed,
} from "@/lib/publications/providers/cian";
import { buildNormalizedLongTermPublicationData } from "@/lib/publications/normalized-long-term";
import { makeNormalizedCianFixture } from "../helpers/cian-fixtures";
import { prisma } from "@/lib/prisma";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";
import { authedRequest, createTestSessionCookie } from "../helpers/auth";

async function createOwnerWithCommissionProperty(opts?: {
  commissionDaily?: number;
  commissionMonthly?: number;
  name?: string;
}) {
  const { channel } = await resetFixtures();
  const owner = await createOwner({
    name: opts?.name ?? `Owner ${Date.now()}`,
    phone: "+7 900 000-00-01",
    email: "owner@example.com",
  });
  const property = await prisma.property.create({
    data: {
      name: "Commission prop",
      slug: `own-set-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
      ownerName: owner.name,
      ownerPhone: owner.phone ?? "+7",
      managementType: "COMMISSION",
      ownerId: owner.id,
      commissionDaily: opts?.commissionDaily ?? 20,
      commissionMonthly: opts?.commissionMonthly ?? 20,
      dailyPrice: 5000,
    },
  });
  return { channel, owner, property };
}

async function createBooking(opts: {
  propertyId: string;
  channelId: string;
  totalAmount: number;
}) {
  const guest = await prisma.guest.create({
    data: { firstName: "G", lastName: "T" },
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
      status: "CONFIRMED",
    },
  });
}

describe("owner settlements (stage 12.4)", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  afterEach(async () => {
    await resetFixtures();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  it("1-2 Owner create + email/phone validation", async () => {
    const owner = await createOwner({ name: "Иван Иванов", phone: "+7 111", email: "a@b.ru" });
    assert.equal(owner.name, "Иван Иванов");
    assert.equal(owner.isActive, true);
    assert.equal("balance" in owner, false);

    assert.equal(createOwnerSchema.safeParse({ name: "X", email: "bad" }).success, false);
    assert.equal(createOwnerSchema.safeParse({ name: "" }).success, false);
    assert.equal(createOwnerSchema.safeParse({ name: "Ok", email: "ok@ex.com" }).success, true);
  });

  it("3-6 COMMISSION link / OWN no owner / multi property / no mutable balance", async () => {
    const { owner, property } = await createOwnerWithCommissionProperty();
    assert.equal(property.ownerId, owner.id);

    const ownProp = await createProperty({
      name: "Own object",
      type: "APARTMENT",
      status: "ACTIVE",
      address: "a",
      city: "c",
      district: "d",
      area: 30,
      rooms: 1,
      bedrooms: 1,
      bathrooms: 1,
      guests: 2,
      description: "d",
      shortDescription: "s",
      ownerName: "Legacy",
      ownerPhone: "+7",
      managementType: "OWN",
      ownerId: owner.id,
    });
    assert.equal(ownProp.ownerId, null);

    await prisma.property.create({
      data: {
        name: "Second",
        slug: `second-${Date.now()}`,
        type: "APARTMENT",
        status: "ACTIVE",
        address: "a",
        city: "c",
        district: "d",
        area: 30,
        rooms: 1,
        bedrooms: 1,
        bathrooms: 1,
        guests: 2,
        description: "d",
        shortDescription: "s",
        ownerName: owner.name,
        ownerPhone: "+7",
        managementType: "COMMISSION",
        ownerId: owner.id,
        commissionDaily: 15,
      },
    });
    assert.equal(await prisma.property.count({ where: { ownerId: owner.id } }), 2);

    const cols = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `PRAGMA table_info('Owner')`,
    );
    assert.equal(cols.some((c) => c.name === "balance"), false);
  });

  it("8-11 short-term owner share from PAID + refund + commission snapshot", async () => {
    const { channel, owner, property } = await createOwnerWithCommissionProperty({
      commissionDaily: 20,
    });
    const booking = await createBooking({
      propertyId: property.id,
      channelId: channel.id,
      totalAmount: 50000,
    });
    await ensureCommissionSnapshot(booking.id);

    let bal = await calculateOwnerBalance(owner.id);
    assert.equal(bal.shortTermOwnerShareOnPaid, 0);

    await recordBookingPayment(booking.id, {
      amount: 20000,
      paidAt: new Date("2026-09-15T12:00:00.000Z"),
      method: "CASH",
      note: null,
    });
    bal = await calculateOwnerBalance(owner.id);
    assert.equal(bal.shortTermOwnerShareOnPaid, 16000);

    await prisma.property.update({
      where: { id: property.id },
      data: { commissionDaily: 50 },
    });
    bal = await calculateOwnerBalance(owner.id);
    assert.equal(bal.shortTermOwnerShareOnPaid, 16000);

    const payment = await prisma.bookingPayment.findFirstOrThrow({
      where: { bookingId: booking.id },
    });
    await recordBookingRefund(booking.id, payment.id, {
      amount: 5000,
      refundedAt: new Date("2026-09-16T12:00:00.000Z"),
      note: "partial",
    });
    bal = await calculateOwnerBalance(owner.id);
    assert.equal(bal.shortTermOwnerShareOnPaid, 12000);
  });

  it("5,34 OWN finances do not create owner debt", async () => {
    const { channel, property } = await resetFixtures();
    assert.equal(property.managementType, "OWN");
    const booking = await createBooking({
      propertyId: property.id,
      channelId: channel.id,
      totalAmount: 10000,
    });
    await recordBookingPayment(booking.id, {
      amount: 10000,
      paidAt: new Date("2026-09-15T12:00:00.000Z"),
      method: null,
      note: null,
    });
    assert.equal(await prisma.owner.count(), 0);
  });

  it("12-15 long-term paid RENT share; unpaid/deposit excluded; snapshot", async () => {
    const { owner, property } = await createOwnerWithCommissionProperty({
      commissionMonthly: 20,
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
      data: { firstName: "T", lastName: "L" },
    });
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

    let bal = await calculateOwnerBalance(owner.id);
    assert.equal(bal.longTermOwnerShareOnPaid, 0);

    const charges = await prisma.longTermCharge.findMany({
      where: { contractId: contract.id },
    });
    const rent = charges.find((c) => c.type === "RENT");
    const deposit = charges.find((c) => c.type === "DEPOSIT");
    assert.ok(rent);
    assert.ok(deposit);

    await recordLongTermPayment(contract.id, {
      amount: 50000,
      paidAt: new Date("2026-10-05T12:00:00.000Z"),
      method: null,
      note: null,
      allocations: [{ chargeId: deposit!.id, amount: 50000 }],
    });
    bal = await calculateOwnerBalance(owner.id);
    assert.equal(bal.longTermOwnerShareOnPaid, 0);

    await recordLongTermPayment(contract.id, {
      amount: 50000,
      paidAt: new Date("2026-10-06T12:00:00.000Z"),
      method: null,
      note: null,
      allocations: [{ chargeId: rent!.id, amount: 50000 }],
    });
    bal = await calculateOwnerBalance(owner.id);
    assert.equal(bal.longTermOwnerShareOnPaid, 40000);

    await prisma.property.update({
      where: { id: property.id },
      data: { commissionMonthly: 40 },
    });
    bal = await calculateOwnerBalance(owner.id);
    assert.equal(bal.longTermOwnerShareOnPaid, 40000);
  });

  it("16-18 expense responsibility OPERATOR/OWNER/legacy", async () => {
    const { owner, property } = await createOwnerWithCommissionProperty();
    await createManualExpense({
      propertyId: property.id,
      amount: 3000,
      category: "REPAIR",
      occurredAt: new Date("2026-09-01T12:00:00.000Z"),
      description: "op",
      expenseResponsibility: "OPERATOR",
    });
    let bal = await calculateOwnerBalance(owner.id);
    assert.equal(bal.ownerExpenses, 0);

    await createManualExpense({
      propertyId: property.id,
      amount: 2000,
      category: "REPAIR",
      occurredAt: new Date("2026-09-02T12:00:00.000Z"),
      description: "own",
      expenseResponsibility: "OWNER",
    });
    bal = await calculateOwnerBalance(owner.id);
    assert.equal(bal.ownerExpenses, 2000);

    await prisma.financialTransaction.create({
      data: {
        propertyId: property.id,
        ownerId: owner.id,
        type: "EXPENSE",
        category: "CLEANING",
        amount: 9000,
        currency: "RUB",
        expenseResponsibility: null,
        occurredAt: new Date("2026-09-03T12:00:00.000Z"),
        sourceType: "MANUAL",
      },
    });
    bal = await calculateOwnerBalance(owner.id);
    assert.equal(bal.ownerExpenses, 2000);
  });

  it("19-27 OwnerPayout creation, ledger, allocation, overpayment", async () => {
    const { channel, owner, property } = await createOwnerWithCommissionProperty({
      commissionDaily: 20,
    });
    const prop2 = await prisma.property.create({
      data: {
        name: "P2",
        slug: `p2-${Date.now()}`,
        type: "APARTMENT",
        status: "ACTIVE",
        address: "a",
        city: "c",
        district: "d",
        area: 30,
        rooms: 1,
        bedrooms: 1,
        bathrooms: 1,
        guests: 2,
        description: "d",
        shortDescription: "s",
        ownerName: owner.name,
        ownerPhone: "+7",
        managementType: "COMMISSION",
        ownerId: owner.id,
        commissionDaily: 20,
      },
    });
    const booking = await createBooking({
      propertyId: property.id,
      channelId: channel.id,
      totalAmount: 50000,
    });
    await ensureCommissionSnapshot(booking.id);
    await recordBookingPayment(booking.id, {
      amount: 50000,
      paidAt: new Date("2026-09-15T12:00:00.000Z"),
      method: null,
      note: null,
    });
    let bal = await calculateOwnerBalance(owner.id);
    assert.equal(bal.balanceDue, 40000);

    await assert.rejects(
      () =>
        createOwnerPayout(owner.id, {
          amount: 10000,
          paidAt: new Date("2026-09-20T12:00:00.000Z"),
          method: null,
          note: null,
          allocations: [
            { propertyId: property.id, amount: 6000 },
            { propertyId: prop2.id, amount: 5000 },
          ],
        }),
      FinanceDomainError,
    );

    const otherOwner = await createOwner({ name: "Other" });
    const foreign = await prisma.property.create({
      data: {
        name: "Foreign",
        slug: `f-${Date.now()}`,
        type: "APARTMENT",
        status: "ACTIVE",
        address: "a",
        city: "c",
        district: "d",
        area: 30,
        rooms: 1,
        bedrooms: 1,
        bathrooms: 1,
        guests: 2,
        description: "d",
        shortDescription: "s",
        ownerName: "x",
        ownerPhone: "+7",
        managementType: "COMMISSION",
        ownerId: otherOwner.id,
        commissionDaily: 10,
      },
    });
    await assert.rejects(
      () =>
        createOwnerPayout(owner.id, {
          amount: 1000,
          paidAt: new Date("2026-09-20T12:00:00.000Z"),
          method: null,
          note: null,
          allocations: [{ propertyId: foreign.id, amount: 1000 }],
        }),
      FinanceDomainError,
    );

    assert.equal(
      createOwnerPayoutSchema.safeParse({
        amount: 0,
        paidAt: "2026-09-20",
        allocations: [{ propertyId: property.id, amount: 1 }],
      }).success,
      false,
    );

    const { payout, exceedsWarning } = await createOwnerPayout(owner.id, {
      amount: 10000,
      paidAt: new Date("2026-09-20T12:00:00.000Z"),
      method: "CASH",
      note: "partial",
      allocations: [
        { propertyId: property.id, amount: 6000 },
        { propertyId: prop2.id, amount: 4000 },
      ],
    });
    assert.equal(exceedsWarning, false);
    assert.equal(payout.amount, 10000);
    assert.equal(payout.allocations.length, 2);

    const txs = await prisma.financialTransaction.findMany({
      where: { sourceKey: ownerPayoutSourceKey(payout.id) },
    });
    assert.equal(txs.length, 1);
    assert.equal(txs[0]!.type, "OWNER_PAYOUT");
    assert.equal(txs[0]!.amount, 10000);

    await syncOwnerPayoutTransaction(payout.id);
    assert.equal(
      await prisma.financialTransaction.count({
        where: { sourceKey: ownerPayoutSourceKey(payout.id) },
      }),
      1,
    );

    bal = await calculateOwnerBalance(owner.id);
    assert.equal(bal.balanceDue, 30000);

    const over = await createOwnerPayout(owner.id, {
      amount: 50000,
      paidAt: new Date("2026-09-21T12:00:00.000Z"),
      method: null,
      note: "advance",
      allocations: [{ propertyId: property.id, amount: 50000 }],
    });
    assert.equal(over.exceedsWarning, true);
    bal = await calculateOwnerBalance(owner.id);
    assert.equal(bal.balanceDue, -20000);
  });

  it("28-30 adjustment reason; inactive owner; no hard delete", async () => {
    const { owner, property } = await createOwnerWithCommissionProperty();
    assert.equal(
      createAdjustmentSchema.safeParse({
        propertyId: property.id,
        amount: 100,
        direction: "CREDIT",
        occurredAt: "2026-09-01",
        description: "",
        ownerId: owner.id,
      }).success,
      false,
    );

    await updateOwner(owner.id, { isActive: false });
    await assert.rejects(
      () =>
        createOwnerPayout(owner.id, {
          amount: 100,
          paidAt: new Date("2026-09-20T12:00:00.000Z"),
          method: null,
          note: null,
          allocations: [{ propertyId: property.id, amount: 100 }],
        }),
      FinanceDomainError,
    );

    await assert.rejects(() => deleteOwnerHard(owner.id), FinanceDomainError);
  });

  it("31-33 balanceAsOf / periodActivity / ST+LT aggregate", async () => {
    const { channel, owner, property } = await createOwnerWithCommissionProperty({
      commissionDaily: 20,
      commissionMonthly: 20,
    });
    const booking = await createBooking({
      propertyId: property.id,
      channelId: channel.id,
      totalAmount: 10000,
    });
    await ensureCommissionSnapshot(booking.id);
    await recordBookingPayment(booking.id, {
      amount: 10000,
      paidAt: new Date("2026-08-15T12:00:00.000Z"),
      method: null,
      note: null,
    });

    const listing = await prisma.longTermListing.create({
      data: {
        propertyId: property.id,
        status: "ACTIVE",
        monthlyPrice: 10000,
        deposit: 0,
        commission: 20,
      },
    });
    const guest = await prisma.guest.create({ data: { firstName: "A", lastName: "B" } });
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
    await generateLongTermCharges(contract.id, {
      fromMonth: "2026-10",
      toMonth: "2026-10",
      includeDeposit: false,
    });
    const rent = await prisma.longTermCharge.findFirstOrThrow({
      where: { contractId: contract.id, type: "RENT" },
    });
    await recordLongTermPayment(contract.id, {
      amount: 10000,
      paidAt: new Date("2026-10-05T12:00:00.000Z"),
      method: null,
      note: null,
      allocations: [{ chargeId: rent.id, amount: 10000 }],
    });

    const asOfAug = await balanceAsOf(owner.id, "2026-08-31");
    assert.equal(asOfAug.shortTermOwnerShareOnPaid, 8000);
    assert.equal(asOfAug.longTermOwnerShareOnPaid, 0);

    const periodOct = await periodActivity(owner.id, "2026-10-01", "2026-10-31");
    assert.equal(periodOct.shortTermOwnerShareOnPaid, 0);
    assert.equal(periodOct.longTermOwnerShareOnPaid, 8000);

    const all = await calculateOwnerBalance(owner.id);
    assert.equal(all.shortTermOwnerShareOnPaid, 8000);
    assert.equal(all.longTermOwnerShareOnPaid, 8000);
    assert.equal(all.ownerShareTotal, 16000);
  });

  it("35-36 Owner data absent from CIAN LT and sale public feeds", async () => {
    const secret = "SECRET_OWNER_XYZ_NEVER_IN_FEED";
    const { owner, property } = await createOwnerWithCommissionProperty({ name: secret });
    await prisma.property.update({
      where: { id: property.id },
      data: { floor: 2, totalFloors: 9 },
    });
    const listing = await prisma.longTermListing.create({
      data: {
        propertyId: property.id,
        status: "ACTIVE",
        monthlyPrice: 40000,
        deposit: 40000,
        commission: 0,
        marketingTitle: "Квартира",
        description: "Описание без владельца",
        publicationContactName: "Менеджер CRM",
        publicationPhoneCountryCode: "+7",
        publicationPhoneNumber: "9000000000",
      },
    });
    const full = await prisma.longTermListing.findUniqueOrThrow({
      where: { id: listing.id },
      include: { property: true, photos: true },
    });
    const normalized = buildNormalizedLongTermPublicationData(full as never);
    assert.notEqual(normalized.contact.name, secret);
    assert.equal(normalized.contact.name, "Менеджер CRM");
    const ltXml = serializeCianFeed([mapToCianFlatRentPayload(normalized)]);
    assert.equal(ltXml.includes(secret), false);
    assert.equal(ltXml.includes(owner.email!), false);

    // Sale/publication contact is listing CRM contact — never Owner model fields
    const fixture = makeNormalizedCianFixture();
    assert.equal(JSON.stringify(fixture).includes(secret), false);
    assert.equal(JSON.stringify(normalized).includes(secret), false);
  });

  it("37-40 auth, CSRF, no-store, registry AUTH_REQUIRED", async () => {
    const unauth = await getOwners(new Request("http://localhost/api/owners"));
    assert.equal(unauth.status, 401);

    const { cookie } = await createTestSessionCookie();
    const ok = await getOwners(authedRequest("http://localhost/api/owners", cookie));
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("Cache-Control"), "no-store");

    const previousOrigin = process.env.APP_ORIGIN;
    process.env.APP_ORIGIN = "https://crm.example.com";
    try {
      assert.equal(getAppOrigin(), "https://crm.example.com");
      const bad = assertTrustedOrigin(
        new Request("http://localhost/api/owners", {
          method: "POST",
          headers: { origin: "https://evil.example" },
        }),
      );
      assert.equal(bad.ok, false);
    } finally {
      process.env.APP_ORIGIN = previousOrigin;
    }

    const created = await postOwner(
      authedRequest("http://localhost/api/owners", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "API Owner" }),
      }),
    );
    assert.equal(created.status, 201);
    assert.equal(created.headers.get("Cache-Control"), "no-store");
    const body = (await created.json()) as { owner: { id: string } };

    const finance = await getOwnerFinance(
      authedRequest(`http://localhost/api/owners/${body.owner.id}/finance`, cookie),
      { params: Promise.resolve({ id: body.owner.id }) },
    );
    assert.equal(finance.status, 200);
    assert.equal(finance.headers.get("Cache-Control"), "no-store");

    const ownerRoutes = API_ROUTE_REGISTRY.filter(
      (r) => r.pathPattern.includes("/owners") || r.pathPattern.includes("owner-settlements"),
    );
    assert.ok(ownerRoutes.length >= 6);
    for (const r of ownerRoutes) {
      assert.equal(r.access, ROUTE_ACCESS.AUTH_REQUIRED);
      assert.equal(
        classifyApiPath(r.pathPattern.replace(/\[id\]/g, "x")),
        ROUTE_ACCESS.AUTH_REQUIRED,
      );
    }
  });
});
