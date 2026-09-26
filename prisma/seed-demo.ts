/**
 * Course Demo seed (Stage 14).
 *
 * Deterministic, idempotent, 100% ARTIFICIAL data for the course demonstration.
 * - No real guest / owner / buyer personal data.
 * - No real provider credentials, no fake CONNECTED integrations.
 * - Dates are built RELATIVE to "today" so the Dashboard always looks current.
 * - Stable `demo-*` ids + upserts → re-running never duplicates rows.
 *
 * Business logic, FSM, and finance semantics are NOT bypassed: all money flows
 * go through the real domain services.
 *
 * Run: npm run demo:seed   (schema must already be applied via migrate deploy)
 */
import { prisma } from "@/lib/prisma";
import { bootstrapAdminUser } from "@/lib/auth/bootstrap";
import {
  ensureCommissionSnapshot,
  recordBookingRefund,
  syncBookingPaymentTransaction,
} from "@/lib/finance/booking-finance";
import { createManualExpense } from "@/lib/finance/service";
import { createCommissionPayment } from "@/lib/finance/commission-finance";
import { generateLongTermCharges, recordLongTermPayment } from "@/lib/finance/long-term-finance";
import { createPresentation } from "@/lib/presentations";
import { setDayPriceRange } from "@/lib/pricing/day-prices";
import {
  linkDemoListingPhotos,
  seedDemoPropertyPhotos,
  wipeDemoPhotoFiles,
} from "@/lib/demo/demo-photos";

// ---------------------------------------------------------------------------
// Relative date helpers (UTC, midday to avoid TZ edge cases).
// ---------------------------------------------------------------------------
const NOW = new Date();
const TODAY_UTC = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate()));

/** Date object N days from today (UTC midnight). */
function day(offset: number): Date {
  const d = new Date(TODAY_UTC);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

/** Current calendar month as "YYYY-MM". */
const CURRENT_MONTH = `${TODAY_UTC.getUTCFullYear()}-${String(TODAY_UTC.getUTCMonth() + 1).padStart(2, "0")}`;

// ---------------------------------------------------------------------------
// Static reference data.
// ---------------------------------------------------------------------------
const salesChannels: Array<{ code: string; name: string }> = [
  { code: "AVITO", name: "Авито" },
  { code: "SUTOCHNO", name: "Суточно.ру" },
  { code: "OSTROVOK", name: "Островок" },
  { code: "YANDEX_TRAVEL", name: "Яндекс Путешествия" },
  { code: "CIAN", name: "ЦИАН" },
  { code: "DOMCLICK", name: "Домклик" },
  { code: "WEBSITE", name: "Сайт" },
  { code: "RECOMMENDATION", name: "По рекомендации" },
  { code: "REGULAR_GUEST", name: "Постоянный гость" },
];

type DemoOwner = { id: string; name: string; phone: string; email: string };
const owners: DemoOwner[] = [
  { id: "demo-owner-1", name: "Демо-собственник Ирина", phone: "+7 900 000-01-01", email: "owner1@demo.local" },
  { id: "demo-owner-2", name: "Демо-собственник Павел", phone: "+7 900 000-01-02", email: "owner2@demo.local" },
  { id: "demo-owner-3", name: "Демо-собственник Марина", phone: "+7 900 000-01-03", email: "owner3@demo.local" },
  { id: "demo-owner-4", name: "Демо-собственник Артём", phone: "+7 900 000-01-04", email: "owner4@demo.local" },
];

type DemoProperty = {
  slug: string;
  name: string;
  type: "APARTMENT" | "STUDIO" | "HOUSE" | "OTHER";
  managementType: "OWN" | "COMMISSION";
  ownerId?: string;
  city: string;
  district: string;
  area: number;
  rooms: number;
  bedrooms: number;
  bathrooms: number;
  guests: number;
  dailyPrice: number;
  monthlyPrice: number;
  commissionDaily: number | null;
  commissionMonthly: number | null;
};

const properties: DemoProperty[] = [
  {
    slug: "demo-morskoy-vid", name: "Апартаменты «Морской вид»", type: "APARTMENT", managementType: "OWN",
    city: "Демоград", district: "Приморский", area: 58, rooms: 2, bedrooms: 1, bathrooms: 1, guests: 4,
    dailyPrice: 6000, monthlyPrice: 90000, commissionDaily: null, commissionMonthly: null,
  },
  {
    slug: "demo-studiya-park", name: "Студия у парка", type: "STUDIO", managementType: "COMMISSION", ownerId: "demo-owner-1",
    city: "Демоград", district: "Парковый", area: 28, rooms: 1, bedrooms: 1, bathrooms: 1, guests: 2,
    dailyPrice: 3200, monthlyPrice: 48000, commissionDaily: 20, commissionMonthly: 15,
  },
  {
    slug: "demo-semeynye", name: "Семейные апартаменты", type: "APARTMENT", managementType: "COMMISSION", ownerId: "demo-owner-2",
    city: "Демоград", district: "Центральный", area: 74, rooms: 3, bedrooms: 2, bathrooms: 1, guests: 6,
    dailyPrice: 7500, monthlyPrice: 115000, commissionDaily: 18, commissionMonthly: 12,
  },
  {
    slug: "demo-panoramnyy-lyuks", name: "Панорамный люкс", type: "APARTMENT", managementType: "OWN",
    city: "Демоград", district: "Деловой", area: 66, rooms: 2, bedrooms: 1, bathrooms: 1, guests: 3,
    dailyPrice: 8000, monthlyPrice: 130000, commissionDaily: null, commissionMonthly: null,
  },
  {
    slug: "demo-terrasa", name: "Апартаменты с террасой", type: "APARTMENT", managementType: "COMMISSION", ownerId: "demo-owner-3",
    city: "Демоприморск", district: "Набережная", area: 82, rooms: 3, bedrooms: 2, bathrooms: 2, guests: 5,
    dailyPrice: 9000, monthlyPrice: 145000, commissionDaily: 17, commissionMonthly: 12,
  },
  {
    slug: "demo-zagorodnyy-dom", name: "Загородный дом", type: "HOUSE", managementType: "OWN",
    city: "Демопосёлок", district: "Лесная", area: 140, rooms: 5, bedrooms: 4, bathrooms: 2, guests: 8,
    dailyPrice: 12000, monthlyPrice: 190000, commissionDaily: null, commissionMonthly: null,
  },
  {
    slug: "demo-loft-centr", name: "Лофт в центре", type: "OTHER", managementType: "COMMISSION", ownerId: "demo-owner-4",
    city: "Демоград", district: "Исторический", area: 64, rooms: 2, bedrooms: 1, bathrooms: 1, guests: 4,
    dailyPrice: 6800, monthlyPrice: 105000, commissionDaily: 19, commissionMonthly: 14,
  },
];

type DemoGuest = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  messengerType: "MAX" | "TELEGRAM";
  messengerContact: string;
};
const guests: DemoGuest[] = [
  { id: "demo-guest-1", firstName: "Анна", lastName: "Демидова", phone: "+7 900 000-10-01", email: "guest1@demo.local", messengerType: "TELEGRAM", messengerContact: "@demo_guest_1" },
  { id: "demo-guest-2", firstName: "Борис", lastName: "Демин", phone: "+7 900 000-10-02", email: "guest2@demo.local", messengerType: "MAX", messengerContact: "demo_guest_2" },
  { id: "demo-guest-3", firstName: "Виктория", lastName: "Демченко", phone: "+7 900 000-10-03", email: "guest3@demo.local", messengerType: "TELEGRAM", messengerContact: "@demo_guest_3" },
  { id: "demo-guest-4", firstName: "Григорий", lastName: "Демьянов", phone: "+7 900 000-10-04", email: "guest4@demo.local", messengerType: "MAX", messengerContact: "demo_guest_4" },
  { id: "demo-guest-5", firstName: "Дарья", lastName: "Демьяненко", phone: "+7 900 000-10-05", email: "guest5@demo.local", messengerType: "TELEGRAM", messengerContact: "@demo_guest_5" },
  { id: "demo-guest-6", firstName: "Егор", lastName: "Демешко", phone: "+7 900 000-10-06", email: "guest6@demo.local", messengerType: "MAX", messengerContact: "demo_guest_6" },
];

/**
 * Delete all business data from the (already guarded) demo database, in
 * FK-safe order. Preserves User/Session so the demo admin login survives a
 * reset. Callers MUST have passed `assertDemoResetAllowed` first.
 */
export async function resetDemoData(): Promise<void> {
  // Children → parents.
  await prisma.presentationSection.deleteMany();
  await prisma.presentationItemPhoto.deleteMany();
  await prisma.presentationItem.deleteMany();
  await prisma.presentation.deleteMany();

  await prisma.longTermPaymentAllocation.deleteMany();
  await prisma.longTermPayment.deleteMany();
  await prisma.longTermCharge.deleteMany();

  await prisma.commissionPayment.deleteMany();

  await prisma.bookingPaymentRefund.deleteMany();
  await prisma.bookingPayment.deleteMany();

  await prisma.financialTransaction.deleteMany();

  await prisma.ownerPayoutAllocation.deleteMany();
  await prisma.ownerPayout.deleteMany();
  await prisma.ownerSettlement.deleteMany();

  await prisma.longTermContract.deleteMany();

  await prisma.externalBooking.deleteMany();
  await prisma.booking.deleteMany();

  await prisma.deposit.deleteMany();
  await prisma.viewing.deleteMany();
  await prisma.buyerHistory.deleteMany();
  await prisma.buyerInterest.deleteMany();
  await prisma.buyer.deleteMany();

  await prisma.saleListingPhoto.deleteMany();
  await prisma.salePublication.deleteMany();
  await prisma.saleListing.deleteMany();

  await prisma.longTermListingPhoto.deleteMany();
  await prisma.publication.deleteMany();
  await prisma.longTermListing.deleteMany();

  await prisma.integrationSyncLog.deleteMany();
  await prisma.integrationConnection.deleteMany();

  await prisma.channelListing.deleteMany();
  await prisma.propertyPhoto.deleteMany();
  await prisma.propertyDayPrice.deleteMany();

  await prisma.guestHistory.deleteMany();
  await prisma.property.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.owner.deleteMany();
  await prisma.salesChannel.deleteMany();

  // Disposable demo photo bytes under storage/demo/ — safe to wipe with demo data.
  await wipeDemoPhotoFiles();
}

// ---------------------------------------------------------------------------
// Seed routine.
// ---------------------------------------------------------------------------
export async function seedDemo(): Promise<void> {
  // 1. Admin (from ADMIN_EMAIL / ADMIN_PASSWORD; never overwrites existing).
  const admin = await bootstrapAdminUser();
  console.log(
    admin.created
      ? `Admin: создан ${admin.email}`
      : admin.email
        ? `Admin: ${admin.email} уже существует (пароль не изменён)`
        : "Admin: пропущен (ADMIN_EMAIL / ADMIN_PASSWORD не заданы)",
  );

  // 2. Sales channels.
  for (const channel of salesChannels) {
    await prisma.salesChannel.upsert({
      where: { code: channel.code },
      update: { name: channel.name, isActive: true },
      create: { code: channel.code, name: channel.name, isActive: true },
    });
  }

  // 3. Owners.
  for (const owner of owners) {
    await prisma.owner.upsert({
      where: { id: owner.id },
      update: { name: owner.name, phone: owner.phone, email: owner.email, isActive: true },
      create: { id: owner.id, name: owner.name, phone: owner.phone, email: owner.email, isActive: true },
    });
  }

  // 4. Properties.
  for (const p of properties) {
    const owner = p.ownerId ? owners.find((o) => o.id === p.ownerId) : undefined;
    const data = {
      name: p.name,
      slug: p.slug,
      type: p.type,
      status: "ACTIVE" as const,
      address: `ул. Демонстрационная, ${p.rooms}${p.slug.slice(-2)}`,
      city: p.city,
      district: p.district,
      area: p.area,
      rooms: p.rooms,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      guests: p.guests,
      shortDescription: `${p.name} — демонстрационный объект Rental OS.`,
      description:
        "Искусственная демонстрационная запись. Не является реальным объектом недвижимости. Используется для показа возможностей CRM.",
      ownerName: owner?.name ?? "Собственный объект (демо)",
      ownerPhone: owner?.phone ?? "+7 900 000-00-00",
      ownerId: p.ownerId ?? null,
      managementType: p.managementType,
      dailyPrice: p.dailyPrice,
      monthlyPrice: p.monthlyPrice,
      commissionDaily: p.commissionDaily,
      commissionMonthly: p.commissionMonthly,
    };
    await prisma.property.upsert({ where: { slug: p.slug }, update: data, create: data });
  }

  const propBySlug = new Map(
    (await prisma.property.findMany({ where: { slug: { startsWith: "demo-" } } })).map((p) => [p.slug, p]),
  );
  const channelByCode = new Map(
    (await prisma.salesChannel.findMany()).map((c) => [c.code, c]),
  );
  const prop = (slug: string) => {
    const found = propBySlug.get(slug);
    if (!found) throw new Error(`Demo property missing: ${slug}`);
    return found;
  };

  // Photos for every demo property → storage/demo/properties/{slug}/ (disposable).
  await seedDemoPropertyPhotos(
    [...propBySlug.values()].map((p) => ({ id: p.id, slug: p.slug })),
  );

  // Nightly price overrides (Stage 16.0): make the calendar pricing visible.
  // Tariff only — does NOT affect Booking.totalAmount or finance. Idempotent (upsert).
  const priceOverrides = [
    { slug: "demo-morskoy-vid", from: `${CURRENT_MONTH}-10`, to: `${CURRENT_MONTH}-14`, price: 9000 },
    { slug: "demo-morskoy-vid", from: `${CURRENT_MONTH}-20`, to: `${CURRENT_MONTH}-22`, price: 4500 },
    { slug: "demo-panoramnyy-lyuks", from: `${CURRENT_MONTH}-05`, to: `${CURRENT_MONTH}-08`, price: 11000 },
    { slug: "demo-loft-centr", from: `${CURRENT_MONTH}-12`, to: `${CURRENT_MONTH}-16`, price: 8200 },
  ];
  for (const o of priceOverrides) {
    await setDayPriceRange({
      propertyId: prop(o.slug).id,
      dateFrom: o.from,
      dateTo: o.to,
      price: o.price,
    });
  }
  const channel = (code: string) => {
    const found = channelByCode.get(code);
    if (!found) throw new Error(`Demo channel missing: ${code}`);
    return found;
  };

  // 5. Guests.
  for (const g of guests) {
    await prisma.guest.upsert({ where: { id: g.id }, update: g, create: g });
  }

  // 6. Bookings — relative dates, FSM-valid, no PENDING/CONFIRMED overlap per property.
  type DemoBooking = {
    id: string;
    slug: string;
    guestId: string;
    channelCode: string;
    from: number;
    to: number;
    guestsCount: number;
    totalAmount: number;
    status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  };
  const bookings: DemoBooking[] = [
    { id: "demo-booking-1", slug: "demo-morskoy-vid", guestId: "demo-guest-1", channelCode: "AVITO", from: -40, to: -35, guestsCount: 3, totalAmount: 30000, status: "COMPLETED" },
    { id: "demo-booking-2", slug: "demo-semeynye", guestId: "demo-guest-2", channelCode: "SUTOCHNO", from: -25, to: -20, guestsCount: 5, totalAmount: 44000, status: "COMPLETED" },
    { id: "demo-booking-3", slug: "demo-panoramnyy-lyuks", guestId: "demo-guest-3", channelCode: "WEBSITE", from: -1, to: 4, guestsCount: 2, totalAmount: 40000, status: "CONFIRMED" },
    { id: "demo-booking-4", slug: "demo-morskoy-vid", guestId: "demo-guest-4", channelCode: "AVITO", from: 10, to: 14, guestsCount: 3, totalAmount: 28000, status: "CONFIRMED" },
    { id: "demo-booking-5", slug: "demo-terrasa", guestId: "demo-guest-5", channelCode: "OSTROVOK", from: 20, to: 25, guestsCount: 4, totalAmount: 45000, status: "PENDING" },
    { id: "demo-booking-6", slug: "demo-zagorodnyy-dom", guestId: "demo-guest-6", channelCode: "RECOMMENDATION", from: 5, to: 8, guestsCount: 6, totalAmount: 36000, status: "CANCELLED" },
    { id: "demo-booking-7", slug: "demo-studiya-park", guestId: "demo-guest-1", channelCode: "REGULAR_GUEST", from: 30, to: 33, guestsCount: 2, totalAmount: 12000, status: "CONFIRMED" },
    { id: "demo-booking-8", slug: "demo-loft-centr", guestId: "demo-guest-2", channelCode: "WEBSITE", from: -10, to: -6, guestsCount: 3, totalAmount: 26000, status: "COMPLETED" },
  ];
  for (const b of bookings) {
    const data = {
      propertyId: prop(b.slug).id,
      guestId: b.guestId,
      salesChannelId: channel(b.channelCode).id,
      checkIn: day(b.from),
      checkOut: day(b.to),
      guestsCount: b.guestsCount,
      totalAmount: b.totalAmount,
      status: b.status,
      comment: "Демонстрационная бронь",
    };
    await prisma.booking.upsert({ where: { id: b.id }, update: data, create: { id: b.id, ...data } });
  }

  // 7. Booking payments (full / partial) + one refund, via finance domain.
  const payments = [
    { id: "demo-pay-1", bookingId: "demo-booking-1", amount: 30000, at: -35, method: "карта", note: "Полная оплата (демо)" },
    { id: "demo-pay-2", bookingId: "demo-booking-2", amount: 44000, at: -20, method: "перевод", note: "Полная оплата (демо)" },
    { id: "demo-pay-3", bookingId: "demo-booking-3", amount: 15000, at: -1, method: "карта", note: "Частичная предоплата (демо)" },
    { id: "demo-pay-8", bookingId: "demo-booking-8", amount: 26000, at: -6, method: "наличные", note: "Полная оплата (демо)" },
  ];
  for (const pay of payments) {
    await ensureCommissionSnapshot(pay.bookingId);
    await prisma.bookingPayment.upsert({
      where: { id: pay.id },
      update: { amount: pay.amount, paidAt: day(pay.at), method: pay.method, note: pay.note },
      create: { id: pay.id, bookingId: pay.bookingId, amount: pay.amount, paidAt: day(pay.at), method: pay.method, note: pay.note },
    });
    await syncBookingPaymentTransaction(pay.id);
  }

  // Partial refund against demo-pay-2 (idempotent guard).
  const existingRefund = await prisma.bookingPaymentRefund.findFirst({ where: { paymentId: "demo-pay-2" } });
  if (!existingRefund) {
    await recordBookingRefund("demo-booking-2", "demo-pay-2", {
      amount: 4000,
      refundedAt: day(-19),
      note: "Возврат части оплаты (демо)",
    });
  }

  // 8. Commission payment from owner for a COMMISSION booking (idempotent guard).
  if ((await prisma.commissionPayment.count({ where: { bookingId: "demo-booking-8" } })) === 0) {
    await createCommissionPayment({
      propertyId: prop("demo-loft-centr").id,
      bookingId: "demo-booking-8",
      amount: Math.round((26000 * 19) / 100),
      paidAt: day(-5),
      method: "перевод",
      note: "Комиссия оператора 19% (демо)",
    });
  }

  // 9. Operator expenses (property-level + one global).
  const expenses = [
    { slug: "demo-morskoy-vid", amount: 3000, category: "CLEANING" as const, at: -34, description: "Уборка после выезда (демо)" },
    { slug: "demo-panoramnyy-lyuks", amount: 1500, category: "LAUNDRY" as const, at: -1, description: "Стирка комплектов (демо)" },
    { slug: "demo-zagorodnyy-dom", amount: 6000, category: "UTILITIES" as const, at: -15, description: "Коммунальные услуги (демо)" },
  ];
  for (const e of expenses) {
    const sourceExists = await prisma.financialTransaction.count({
      where: { propertyId: prop(e.slug).id, category: e.category, description: e.description },
    });
    if (sourceExists === 0) {
      await createManualExpense({
        propertyId: prop(e.slug).id,
        amount: e.amount,
        category: e.category,
        occurredAt: day(e.at),
        description: e.description,
      });
    }
  }
  if ((await prisma.financialTransaction.count({ where: { sourceKey: "DEMO:EXPENSE:ADVERTISING" } })) === 0) {
    await prisma.financialTransaction.create({
      data: {
        propertyId: null,
        type: "EXPENSE",
        category: "ADVERTISING",
        amount: 8000,
        economicRole: "BUSINESS_EXPENSE",
        expenseResponsibility: "OPERATOR",
        occurredAt: day(-5),
        description: "Реклама объектов (демо)",
        sourceType: "MANUAL",
        sourceKey: "DEMO:EXPENSE:ADVERTISING",
      },
    });
  }

  // 10. Long-term: one ACTIVE listing+contract, one PAUSED listing.
  const ltActive = await prisma.longTermListing.upsert({
    where: { propertyId: prop("demo-semeynye").id },
    update: {
      status: "ACTIVE", monthlyPrice: 115000, deposit: 115000, commission: 12, minimumRentalPeriod: 6,
      marketingTitle: "Семейные апартаменты — длительная аренда", description: "Демонстрационное объявление долгосрочной аренды.",
    },
    create: {
      propertyId: prop("demo-semeynye").id,
      status: "ACTIVE", monthlyPrice: 115000, deposit: 115000, commission: 12, minimumRentalPeriod: 6,
      marketingTitle: "Семейные апартаменты — длительная аренда", description: "Демонстрационное объявление долгосрочной аренды.",
    },
  });

  await prisma.longTermListing.upsert({
    where: { propertyId: prop("demo-zagorodnyy-dom").id },
    update: {
      status: "PAUSED", monthlyPrice: 190000, deposit: 190000, commission: 0, minimumRentalPeriod: 12,
      marketingTitle: "Загородный дом — длительная аренда (на паузе)", description: "Демонстрационное объявление на паузе.",
    },
    create: {
      propertyId: prop("demo-zagorodnyy-dom").id,
      status: "PAUSED", monthlyPrice: 190000, deposit: 190000, commission: 0, minimumRentalPeriod: 12,
      marketingTitle: "Загородный дом — длительная аренда (на паузе)", description: "Демонстрационное объявление на паузе.",
    },
  });

  const contract = await prisma.longTermContract.upsert({
    where: { id: "demo-lt-contract-1" },
    update: { status: "ACTIVE", monthlyRent: 115000, depositAmount: 115000, commissionRateBps: 1200, paymentDay: 5 },
    create: {
      id: "demo-lt-contract-1",
      propertyId: prop("demo-semeynye").id,
      longTermListingId: ltActive.id,
      guestId: "demo-guest-2",
      status: "ACTIVE",
      startDate: day(-20),
      monthlyRent: 115000,
      depositAmount: 115000,
      commissionRateBps: 1200,
      paymentDay: 5,
      notes: "Демонстрационный договор долгосрочной аренды",
    },
  });
  await generateLongTermCharges(contract.id, { fromMonth: CURRENT_MONTH, toMonth: CURRENT_MONTH, includeDeposit: true });
  if ((await prisma.longTermPayment.count({ where: { contractId: contract.id } })) === 0) {
    await recordLongTermPayment(contract.id, {
      amount: 70000,
      paidAt: day(-2),
      method: "перевод",
      note: "Частичная оплата аренды (демо)",
    });
  }

  // 11. Sales: ACTIVE + DRAFT listings, buyers, interests, viewing, deposit.
  const saleActive = await prisma.saleListing.upsert({
    where: { propertyId: prop("demo-studiya-park").id },
    update: {
      status: "ACTIVE", price: 9500000, specialOfferPrice: 8990000, specialOfferText: "Спеццена при быстрой сделке",
      marketingTitle: "Студия у парка — продажа", description: "Демонстрационная карточка продажи.", advantages: "Готова к показу",
      publicationContactName: "Демо-менеджер продаж", publicationPhoneCountryCode: "7", publicationPhoneNumber: "9000000000",
    },
    create: {
      propertyId: prop("demo-studiya-park").id,
      status: "ACTIVE", price: 9500000, specialOfferPrice: 8990000, specialOfferText: "Спеццена при быстрой сделке",
      marketingTitle: "Студия у парка — продажа", description: "Демонстрационная карточка продажи.", advantages: "Готова к показу",
      publicationContactName: "Демо-менеджер продаж", publicationPhoneCountryCode: "7", publicationPhoneNumber: "9000000000",
    },
  });

  await prisma.saleListing.upsert({
    where: { propertyId: prop("demo-loft-centr").id },
    update: { status: "DRAFT", price: 0, marketingTitle: "Лофт в центре — черновик продажи", description: "Черновик карточки продажи (демо)." },
    create: {
      propertyId: prop("demo-loft-centr").id,
      status: "DRAFT", price: 0, marketingTitle: "Лофт в центре — черновик продажи", description: "Черновик карточки продажи (демо).",
    },
  });

  const buyers = [
    { id: "demo-buyer-1", name: "Демо-покупатель Ольга", phone: "+7 900 000-20-01", email: "buyer1@demo.local", messengerType: "TELEGRAM" as const, messengerContact: "@demo_buyer_1", notes: "Активный интерес к студии" },
    { id: "demo-buyer-2", name: "Демо-покупатель Сергей", phone: "+7 900 000-20-02", email: "buyer2@demo.local", messengerType: "MAX" as const, messengerContact: "demo_buyer_2", notes: "Сравнивает варианты" },
    { id: "demo-buyer-3", name: "Демо-покупатель Наталья", phone: "+7 900 000-20-03", email: null, messengerType: null, messengerContact: null, notes: "Первичный контакт" },
  ];
  for (const b of buyers) {
    await prisma.buyer.upsert({ where: { id: b.id }, update: b, create: b });
  }

  const interest1 = await prisma.buyerInterest.upsert({
    where: { buyerId_saleListingId: { buyerId: "demo-buyer-1", saleListingId: saleActive.id } },
    update: { status: "VIEWING_SCHEDULED", notes: "Записан на показ" },
    create: { id: "demo-interest-1", buyerId: "demo-buyer-1", saleListingId: saleActive.id, status: "VIEWING_SCHEDULED", notes: "Записан на показ" },
  });
  await prisma.buyerInterest.upsert({
    where: { buyerId_saleListingId: { buyerId: "demo-buyer-2", saleListingId: saleActive.id } },
    update: { status: "THINKING", notes: "Думает над предложением" },
    create: { id: "demo-interest-2", buyerId: "demo-buyer-2", saleListingId: saleActive.id, status: "THINKING", notes: "Думает над предложением" },
  });

  await prisma.viewing.upsert({
    where: { id: "demo-viewing-1" },
    update: { buyerInterestId: interest1.id, scheduledAt: day(3), status: "SCHEDULED", notes: "Показ студии (демо)" },
    create: { id: "demo-viewing-1", buyerInterestId: interest1.id, scheduledAt: day(3), status: "SCHEDULED", notes: "Показ студии (демо)" },
  });

  await prisma.deposit.upsert({
    where: { id: "demo-deposit-1" },
    update: { buyerInterestId: interest1.id, amount: 300000, status: "PENDING", paidAt: null, notes: "Задаток ожидает оплаты (демо)" },
    create: { id: "demo-deposit-1", buyerInterestId: interest1.id, amount: 300000, status: "PENDING", notes: "Задаток ожидает оплаты (демо)" },
  });

  // NOT_PUBLISHED SalePublication rows (no fake externalId / CONNECTED).
  const salePubChannels = await prisma.salesChannel.findMany({ where: { code: { in: ["AVITO", "CIAN", "DOMCLICK"] } } });
  for (const ch of salePubChannels) {
    await prisma.salePublication.upsert({
      where: { saleListingId_salesChannelId: { saleListingId: saleActive.id, salesChannelId: ch.id } },
      update: {},
      create: { saleListingId: saleActive.id, salesChannelId: ch.id, status: "NOT_PUBLISHED" },
    });
  }

  // Attach property photos to LT / Sale listing galleries.
  await linkDemoListingPhotos();

  // 12. Presentations: one DRAFT, one PUBLISHED (secure random tokens, guarded).
  const draftTitle = "Демо-подборка (черновик)";
  const publishedTitle = "Демо-подборка для клиента";
  if ((await prisma.presentation.count({ where: { title: draftTitle } })) === 0) {
    await createPresentation({
      kind: "SHORT_TERM",
      propertyIds: [prop("demo-morskoy-vid").id, prop("demo-panoramnyy-lyuks").id],
      title: draftTitle,
      subtitle: "Черновик подборки для показа возможностей",
    });
  }
  if ((await prisma.presentation.count({ where: { title: publishedTitle } })) === 0) {
    const published = await createPresentation({
      kind: "SHORT_TERM",
      propertyIds: [prop("demo-morskoy-vid").id, prop("demo-terrasa").id],
      title: publishedTitle,
      subtitle: "Опубликованная демо-подборка",
    });
    await prisma.presentation.update({
      where: { id: published.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
  }

  // Summary.
  const [propCount, guestCount, bookingCount, ownerCount, buyerCount, presentationCount] = await Promise.all([
    prisma.property.count({ where: { slug: { startsWith: "demo-" } } }),
    prisma.guest.count(),
    prisma.booking.count(),
    prisma.owner.count(),
    prisma.buyer.count(),
    prisma.presentation.count(),
  ]);
  console.log("Demo seed complete:");
  console.log(`  properties=${propCount} owners=${ownerCount} guests=${guestCount} bookings=${bookingCount} buyers=${buyerCount} presentations=${presentationCount}`);
}

// Allow direct execution: `tsx prisma/seed-demo.ts`.
const isMain = process.argv[1] ? /seed-demo\.(ts|js)$/.test(process.argv[1]) : false;
if (isMain) {
  seedDemo()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
