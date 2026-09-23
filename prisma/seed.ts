import { PrismaClient, type Prisma } from "@prisma/client";
import { bootstrapAdminUser } from "../lib/auth/bootstrap";

const prisma = new PrismaClient();

const salesChannels: Array<{ code: string; name: string }> = [
  { code: "AVITO", name: "Авито" },
  { code: "SUTOCHNO", name: "Суточно.ру" },
  { code: "OSTROVOK", name: "Островок" },
  { code: "YANDEX_TRAVEL", name: "Яндекс Путешествия" },
  { code: "KORZINA", name: "Корзина" },
  { code: "REGULAR_GUEST", name: "Постоянный гость" },
  { code: "CIAN", name: "ЦИАН" },
  { code: "DOMCLICK", name: "Домклик" },
  { code: "WEBSITE", name: "Сайт" },
  { code: "LANDING", name: "Лендинг" },
  { code: "RECOMMENDATION", name: "По рекомендации" },
];

const LEGACY_DEMO_SLUGS = [
  "dvushka-na-patriarshih",
  "studiya-krylatskoe",
  "treshka-sochi-centr",
  "dom-krasnaya-polyana",
  "odnushka-vasilevskiy",
  "apartamenty-nevskiy",
  "studiya-baumana-kazan",
  "kvartira-adler-more",
  "dom-odincovo",
  "loft-istoricheskiy-centr",
];

const properties: Prisma.PropertyCreateInput[] = [
  {
    name: "Тестовый объект 1 — квартира",
    slug: "test-object-1",
    type: "APARTMENT",
    status: "ACTIVE",
    address: "ул. Тестовая, д. 1, кв. 1",
    city: "Тестовый город",
    district: "Район А",
    area: 42,
    rooms: 1,
    bedrooms: 1,
    bathrooms: 1,
    floor: 2,
    totalFloors: 5,
    guests: 2,
    shortDescription: "Нейтральная тестовая квартира для проверки CRM.",
    description:
      "Демонстрационная запись. Не является реальным объектом недвижимости. Нужна для разработки списка, карточки и API.",
    ownerName: "Тестовый владелец 1",
    ownerPhone: "+7 000 000-00-01",
    managementType: "OWN",
    dailyPrice: 3500,
    monthlyPrice: 55000,
    commissionDaily: null,
    commissionMonthly: null,
  },
  {
    name: "Тестовый объект 2 — студия",
    slug: "test-object-2",
    type: "STUDIO",
    status: "ACTIVE",
    address: "ул. Тестовая, д. 2, кв. 2",
    city: "Тестовый город",
    district: "Район Б",
    area: 26,
    rooms: 1,
    bedrooms: 1,
    bathrooms: 1,
    floor: 7,
    totalFloors: 12,
    guests: 2,
    shortDescription: "Нейтральная тестовая студия для проверки CRM.",
    description:
      "Демонстрационная запись. Не является реальным объектом недвижимости. Используется для проверки типа STUDIO.",
    ownerName: "Тестовый владелец 2",
    ownerPhone: "+7 000 000-00-02",
    managementType: "COMMISSION",
    rentCollectionMode: "OWNER_DIRECT",
    dailyPrice: 2800,
    monthlyPrice: 43000,
    commissionDaily: 20,
    commissionMonthly: 15,
  },
  {
    name: "Тестовый объект 3 — квартира",
    slug: "test-object-3",
    type: "APARTMENT",
    status: "ACTIVE",
    address: "ул. Тестовая, д. 3, кв. 3",
    city: "Демо-город",
    district: "Район В",
    area: 68,
    rooms: 2,
    bedrooms: 1,
    bathrooms: 1,
    floor: 4,
    totalFloors: 9,
    guests: 4,
    shortDescription: "Нейтральная тестовая двушка для проверки CRM.",
    description:
      "Демонстрационная запись. Не является реальным объектом недвижимости. Используется для проверки комиссионного управления.",
    ownerName: "Тестовый владелец 3",
    ownerPhone: "+7 000 000-00-03",
    managementType: "COMMISSION",
    dailyPrice: 5400,
    monthlyPrice: 89000,
    commissionDaily: 18,
    commissionMonthly: 12,
  },
  {
    name: "Тестовый объект 4 — дом",
    slug: "test-object-4",
    type: "HOUSE",
    status: "ACTIVE",
    address: "ул. Тестовая, д. 4",
    city: "Демо-посёлок",
    district: "Район Г",
    area: 120,
    rooms: 4,
    bedrooms: 3,
    bathrooms: 2,
    floor: null,
    totalFloors: 2,
    guests: 8,
    shortDescription: "Нейтральный тестовый дом для проверки CRM.",
    description:
      "Демонстрационная запись. Не является реальным объектом недвижимости. Используется для проверки типа HOUSE и управления OWN.",
    ownerName: "Тестовый владелец 4",
    ownerPhone: "+7 000 000-00-04",
    managementType: "OWN",
    dailyPrice: 9800,
    monthlyPrice: 150000,
    commissionDaily: null,
    commissionMonthly: null,
  },
  {
    name: "Тестовый объект 5 — квартира",
    slug: "test-object-5",
    type: "APARTMENT",
    status: "INACTIVE",
    address: "ул. Тестовая, д. 5, кв. 5",
    city: "Тестовый город",
    district: "Район Д",
    area: 35,
    rooms: 1,
    bedrooms: 1,
    bathrooms: 1,
    floor: 1,
    totalFloors: 4,
    guests: 2,
    shortDescription: "Неактивная тестовая квартира для проверки статусов.",
    description:
      "Демонстрационная запись. Не является реальным объектом недвижимости. Статус INACTIVE нужен для проверки отображения в CRM.",
    ownerName: "Тестовый владелец 5",
    ownerPhone: "+7 000 000-00-05",
    managementType: "COMMISSION",
    dailyPrice: 3100,
    monthlyPrice: 48000,
    commissionDaily: 22,
    commissionMonthly: 16,
  },
  {
    name: "Тестовый объект 6 — квартира",
    slug: "test-object-6",
    type: "APARTMENT",
    status: "ACTIVE",
    address: "ул. Тестовая, д. 6, кв. 6",
    city: "Примерск",
    district: "Район Е",
    area: 81,
    rooms: 3,
    bedrooms: 2,
    bathrooms: 2,
    floor: 6,
    totalFloors: 10,
    guests: 6,
    shortDescription: "Нейтральная тестовая трёшка для проверки CRM.",
    description:
      "Демонстрационная запись. Не является реальным объектом недвижимости. Используется для проверки площади и числа комнат.",
    ownerName: "Тестовый владелец 6",
    ownerPhone: "+7 000 000-00-06",
    managementType: "COMMISSION",
    dailyPrice: 7200,
    monthlyPrice: 120000,
    commissionDaily: 15,
    commissionMonthly: 10,
  },
  {
    name: "Тестовый объект 7 — студия",
    slug: "test-object-7",
    type: "STUDIO",
    status: "ARCHIVED",
    address: "ул. Тестовая, д. 7, кв. 7",
    city: "Примерск",
    district: "Район Ж",
    area: 22,
    rooms: 1,
    bedrooms: 1,
    bathrooms: 1,
    floor: 3,
    totalFloors: 6,
    guests: 2,
    shortDescription: "Архивная тестовая студия для проверки статусов.",
    description:
      "Демонстрационная запись. Не является реальным объектом недвижимости. Статус ARCHIVED нужен для проверки отображения в CRM.",
    ownerName: "Тестовый владелец 7",
    ownerPhone: "+7 000 000-00-07",
    managementType: "COMMISSION",
    dailyPrice: 2100,
    monthlyPrice: 36000,
    commissionDaily: 25,
    commissionMonthly: 18,
  },
  {
    name: "Тестовый объект 8 — квартира",
    slug: "test-object-8",
    type: "APARTMENT",
    status: "ACTIVE",
    address: "ул. Тестовая, д. 8, кв. 8",
    city: "Демо-город",
    district: "Район З",
    area: 54,
    rooms: 2,
    bedrooms: 1,
    bathrooms: 1,
    floor: 5,
    totalFloors: 8,
    guests: 4,
    shortDescription: "Нейтральная тестовая квартира для проверки цен.",
    description:
      "Демонстрационная запись. Не является реальным объектом недвижимости. Используется для проверки посуточной и помесячной цены.",
    ownerName: "Тестовый владелец 8",
    ownerPhone: "+7 000 000-00-08",
    managementType: "COMMISSION",
    dailyPrice: 4600,
    monthlyPrice: 77000,
    commissionDaily: 17,
    commissionMonthly: 12,
  },
  {
    name: "Тестовый объект 9 — дом",
    slug: "test-object-9",
    type: "HOUSE",
    status: "INACTIVE",
    address: "ул. Тестовая, д. 9",
    city: "Демо-посёлок",
    district: "Район И",
    area: 155,
    rooms: 5,
    bedrooms: 4,
    bathrooms: 3,
    floor: null,
    totalFloors: 2,
    guests: 10,
    shortDescription: "Неактивный тестовый дом для проверки статусов.",
    description:
      "Демонстрационная запись. Не является реальным объектом недвижимости. Используется для проверки большого дома и управления OWN.",
    ownerName: "Тестовый владелец 9",
    ownerPhone: "+7 000 000-00-09",
    managementType: "OWN",
    dailyPrice: 14000,
    monthlyPrice: 210000,
    commissionDaily: null,
    commissionMonthly: null,
  },
  {
    name: "Тестовый объект 10 — лофт",
    slug: "test-object-10",
    type: "OTHER",
    status: "ACTIVE",
    address: "ул. Тестовая, д. 10, пом. 1",
    city: "Тестовый город",
    district: "Район К",
    area: 70,
    rooms: 2,
    bedrooms: 1,
    bathrooms: 1,
    floor: 1,
    totalFloors: 3,
    guests: 4,
    shortDescription: "Нейтральный тестовый лофт для проверки типа OTHER.",
    description:
      "Демонстрационная запись. Не является реальным объектом недвижимости. Используется для проверки нестандартного типа объекта.",
    ownerName: "Тестовый владелец 10",
    ownerPhone: "+7 000 000-00-10",
    managementType: "COMMISSION",
    dailyPrice: 6100,
    monthlyPrice: 99000,
    commissionDaily: 19,
    commissionMonthly: 14,
  },
];

async function main() {
  const adminBootstrap = await bootstrapAdminUser();
  if (adminBootstrap.created) {
    console.log(`Admin bootstrap: создан пользователь ${adminBootstrap.email}`);
  } else if (adminBootstrap.skipped && adminBootstrap.email) {
    console.log(`Admin bootstrap: пользователь ${adminBootstrap.email} уже существует (пароль не изменён)`);
  } else {
    console.log("Admin bootstrap: пропущен (ADMIN_EMAIL / ADMIN_PASSWORD не заданы)");
  }

  for (const channel of salesChannels) {
    await prisma.salesChannel.upsert({
      where: { code: channel.code },
      update: { name: channel.name, isActive: true },
      create: { code: channel.code, name: channel.name, isActive: true },
    });
  }

  await prisma.property.deleteMany({
    where: { slug: { in: LEGACY_DEMO_SLUGS } },
  });

  for (const property of properties) {
    await prisma.property.upsert({
      where: { slug: property.slug },
      update: property,
      create: property,
    });
  }

  const commissionProperties = await prisma.property.findMany({
    where: { managementType: "COMMISSION" },
    select: { id: true, slug: true, ownerName: true, ownerPhone: true },
  });

  for (const prop of commissionProperties) {
    let owner = await prisma.owner.findFirst({ where: { name: prop.ownerName } });
    if (!owner) {
      owner = await prisma.owner.create({
        data: {
          id: `seed-owner-${prop.slug}`,
          name: prop.ownerName,
          phone: prop.ownerPhone,
          isActive: true,
        },
      });
    } else {
      owner = await prisma.owner.update({
        where: { id: owner.id },
        data: { phone: prop.ownerPhone, isActive: true },
      });
    }
    await prisma.property.update({
      where: { id: prop.id },
      data: { ownerId: owner.id },
    });
  }

  const demoOwner = await prisma.owner.findFirst({
    where: { name: "Тестовый владелец 2" },
  });
  const demoProperty = await prisma.property.findUnique({ where: { slug: "test-object-2" } });
  if (demoOwner && demoProperty) {
    const existingPayout = await prisma.ownerPayout.findFirst({
      where: { ownerId: demoOwner.id, note: "Демо-выплата seed" },
    });
    if (!existingPayout) {
      const payout = await prisma.ownerPayout.create({
        data: {
          id: "seed-owner-payout-1",
          ownerId: demoOwner.id,
          amount: 5000,
          paidAt: new Date("2026-08-15T12:00:00.000Z"),
          method: "Перевод",
          note: "Демо-выплата seed",
          allocations: {
            create: [{ propertyId: demoProperty.id, amount: 5000 }],
          },
        },
      });
      const { syncOwnerPayoutTransaction } = await import("../lib/finance/owner-settlements");
      await syncOwnerPayoutTransaction(payout.id);
    }
  }

  const avito = await prisma.salesChannel.findUnique({ where: { code: "AVITO" } });
  const recommendation = await prisma.salesChannel.findUnique({
    where: { code: "RECOMMENDATION" },
  });
  const regularGuest = await prisma.salesChannel.findUnique({
    where: { code: "REGULAR_GUEST" },
  });
  const propertyOne = await prisma.property.findUnique({ where: { slug: "test-object-1" } });
  const propertyTwo = await prisma.property.findUnique({ where: { slug: "test-object-2" } });
  const propertyThree = await prisma.property.findUnique({ where: { slug: "test-object-3" } });
  const propertyFour = await prisma.property.findUnique({ where: { slug: "test-object-4" } });
  const propertySix = await prisma.property.findUnique({ where: { slug: "test-object-6" } });
  const propertyEight = await prisma.property.findUnique({ where: { slug: "test-object-8" } });

  if (
    !avito ||
    !recommendation ||
    !regularGuest ||
    !propertyOne ||
    !propertyTwo ||
    !propertyThree ||
    !propertyFour ||
    !propertySix ||
    !propertyEight
  ) {
    throw new Error("Не найдены тестовые объекты или каналы для seed гостей и броней");
  }

  const guests = [
    {
      id: "seed-guest-1",
      firstName: "Тестовый",
      lastName: "Гость",
      middleName: "Первый",
      phone: "+7 000 000-10-01",
      email: "guest1@test.local",
      messengerType: "MAX" as const,
      messengerContact: "@test_guest_1",
      comment: "Тестовый гость 1",
    },
    {
      id: "seed-guest-2",
      firstName: "Тестовый",
      lastName: "Гость",
      middleName: "Второй",
      phone: "+7 000 000-10-02",
      email: "guest2@test.local",
      messengerType: "TELEGRAM" as const,
      messengerContact: "@test_guest_2",
      comment: "Тестовый гость 2",
    },
    {
      id: "seed-guest-3",
      firstName: "Тестовый",
      lastName: "Гость",
      middleName: "Третий",
      phone: "+7 000 000-10-03",
      email: null,
      messengerType: null,
      messengerContact: null,
      comment: "Тестовый гость 3",
    },
  ];

  for (const guest of guests) {
    await prisma.guest.upsert({
      where: { id: guest.id },
      update: guest,
      create: guest,
    });
  }

  const bookings = [
    {
      id: "seed-booking-1",
      propertyId: propertyOne.id,
      guestId: "seed-guest-1",
      salesChannelId: avito.id,
      checkIn: new Date(Date.UTC(2026, 8, 15)),
      checkOut: new Date(Date.UTC(2026, 8, 20)),
      guestsCount: 2,
      totalAmount: 25000,
      status: "CONFIRMED" as const,
      comment: "Тестовая бронь 1",
    },
    {
      id: "seed-booking-2",
      propertyId: propertyThree.id,
      guestId: "seed-guest-2",
      salesChannelId: recommendation.id,
      checkIn: new Date(Date.UTC(2026, 9, 1)),
      checkOut: new Date(Date.UTC(2026, 9, 5)),
      guestsCount: 3,
      totalAmount: 42000,
      status: "PENDING" as const,
      comment: "Тестовая бронь 2",
    },
    {
      id: "seed-booking-3",
      propertyId: propertyTwo.id,
      guestId: "seed-guest-3",
      salesChannelId: regularGuest.id,
      checkIn: new Date(Date.UTC(2026, 8, 10)),
      checkOut: new Date(Date.UTC(2026, 8, 12)),
      guestsCount: 1,
      totalAmount: 8000,
      status: "CANCELLED" as const,
      comment: "Тестовая бронь 3",
    },
    {
      id: "seed-booking-4",
      propertyId: propertyFour.id,
      guestId: "seed-guest-1",
      salesChannelId: recommendation.id,
      checkIn: new Date(Date.UTC(2026, 7, 20)),
      checkOut: new Date(Date.UTC(2026, 7, 25)),
      guestsCount: 4,
      totalAmount: 45000,
      status: "COMPLETED" as const,
      comment: "Тестовая бронь 4",
    },
    {
      id: "seed-booking-5",
      propertyId: propertySix.id,
      guestId: "seed-guest-2",
      salesChannelId: avito.id,
      checkIn: new Date(Date.UTC(2026, 8, 1)),
      checkOut: new Date(Date.UTC(2026, 8, 8)),
      guestsCount: 3,
      totalAmount: 36000,
      status: "CONFIRMED" as const,
      comment: "Тестовая бронь 5",
    },
    {
      id: "seed-booking-6",
      propertyId: propertyEight.id,
      guestId: "seed-guest-3",
      salesChannelId: regularGuest.id,
      checkIn: new Date(Date.UTC(2026, 7, 28)),
      checkOut: new Date(Date.UTC(2026, 8, 1)),
      guestsCount: 2,
      totalAmount: 18000,
      status: "CONFIRMED" as const,
      comment: "Тестовая бронь 6",
    },
  ];

  for (const booking of bookings) {
    await prisma.booking.upsert({
      where: { id: booking.id },
      update: booking,
      create: booking,
    });
  }

  // Demo booking payments (idempotent). seed-booking-1 stays unpaid.
  const { ensureCommissionSnapshot, syncBookingPaymentTransaction } = await import(
    "@/lib/finance/booking-finance"
  );

  const demoPayments = [
    {
      id: "seed-booking-payment-partial",
      bookingId: "seed-booking-5",
      amount: 10000,
      paidAt: new Date(Date.UTC(2026, 8, 2)),
      method: "перевод",
      note: "Частичная предоплата (демо)",
    },
    {
      id: "seed-booking-payment-full",
      bookingId: "seed-booking-4",
      amount: 45000,
      paidAt: new Date(Date.UTC(2026, 7, 19)),
      method: "наличные",
      note: "Полная оплата (демо)",
    },
  ];

  for (const payment of demoPayments) {
    await ensureCommissionSnapshot(payment.bookingId);
    await prisma.bookingPayment.upsert({
      where: { id: payment.id },
      update: {
        amount: payment.amount,
        paidAt: payment.paidAt,
        method: payment.method,
        note: payment.note,
      },
      create: payment,
    });
    await syncBookingPaymentTransaction(payment.id);
  }

  const history = [
    {
      id: "seed-history-1",
      guestId: "seed-guest-1",
      type: "CONTACT" as const,
      title: "Обращение",
      description: "Тестовый канал продаж → интересуется тестовым объектом 1",
    },
    {
      id: "seed-history-2",
      guestId: "seed-guest-1",
      type: "BOOKING_CREATED" as const,
      title: "Создано бронирование",
      description: "Тестовый объект 1 — квартира, 2026-09-15 — 2026-09-20",
    },
    {
      id: "seed-history-3",
      guestId: "seed-guest-2",
      type: "BOOKING_CREATED" as const,
      title: "Создано бронирование",
      description: "Тестовый объект 3 — квартира, 2026-10-01 — 2026-10-05",
    },
    {
      id: "seed-history-4",
      guestId: "seed-guest-3",
      type: "BOOKING_CREATED" as const,
      title: "Создано бронирование",
      description: "Тестовый объект 2 — студия, 2026-09-10 — 2026-09-12",
    },
    {
      id: "seed-history-5",
      guestId: "seed-guest-3",
      type: "BOOKING_CANCELLED" as const,
      title: "Бронирование отменено",
      description: "Тестовая отмена",
    },
    {
      id: "seed-history-6",
      guestId: "seed-guest-1",
      type: "BOOKING_CREATED" as const,
      title: "Создано бронирование",
      description: "Тестовый объект 4 — дом, 2026-08-20 — 2026-08-25",
    },
    {
      id: "seed-history-7",
      guestId: "seed-guest-1",
      type: "CHECK_OUT" as const,
      title: "Выселение",
      description: "Тестовый объект 4 — дом",
    },
    {
      id: "seed-history-8",
      guestId: "seed-guest-2",
      type: "BOOKING_CREATED" as const,
      title: "Создано бронирование",
      description: "Тестовый объект 6 — квартира, 2026-09-01 — 2026-09-08",
    },
    {
      id: "seed-history-9",
      guestId: "seed-guest-3",
      type: "BOOKING_CREATED" as const,
      title: "Создано бронирование",
      description: "Тестовый объект 8 — квартира, 2026-08-28 — 2026-09-01",
    },
  ];

  for (const entry of history) {
    await prisma.guestHistory.upsert({
      where: { id: entry.id },
      update: entry,
      create: entry,
    });
  }

  await prisma.longTermListing.upsert({
    where: { propertyId: propertyOne.id },
    update: {
      status: "ACTIVE",
      monthlyPrice: 65000,
      specialOfferPrice: 60000,
      specialOfferText: "Скидка при аренде от 6 месяцев",
      deposit: 65000,
      commission: 0,
      minimumRentalPeriod: 6,
      marketingTitle: "Тестовая долгосрочная аренда",
      description: "Рекламный текст долгосрочной аренды. Не описание объекта Property.",
      rentalTerms: "От 6 месяцев",
    },
    create: {
      propertyId: propertyOne.id,
      status: "ACTIVE",
      monthlyPrice: 65000,
      specialOfferPrice: 60000,
      specialOfferText: "Скидка при аренде от 6 месяцев",
      deposit: 65000,
      commission: 0,
      minimumRentalPeriod: 6,
      marketingTitle: "Тестовая долгосрочная аренда",
      description: "Рекламный текст долгосрочной аренды. Не описание объекта Property.",
      rentalTerms: "От 6 месяцев",
    },
  });

  const listingThree = await prisma.longTermListing.upsert({
    where: { propertyId: propertyThree.id },
    update: {
      status: "ACTIVE",
      monthlyPrice: 80000,
      deposit: 80000,
      commission: 18,
      minimumRentalPeriod: 3,
      marketingTitle: "Демо LT — объект 3",
      description: "Демо объявление для договора",
    },
    create: {
      propertyId: propertyThree.id,
      status: "ACTIVE",
      monthlyPrice: 80000,
      deposit: 80000,
      commission: 18,
      minimumRentalPeriod: 3,
      marketingTitle: "Демо LT — объект 3",
      description: "Демо объявление для договора",
    },
  });

  // Stage 12.3 demo contracts (idempotent).
  {
    const { generateLongTermCharges, recordLongTermPayment } = await import(
      "@/lib/finance/long-term-finance"
    );

    const listingOne = await prisma.longTermListing.findUniqueOrThrow({
      where: { propertyId: propertyOne.id },
    });

    await prisma.longTermContract.upsert({
      where: { id: "seed-lt-contract-draft" },
      update: {
        monthlyRent: 65000,
        depositAmount: 65000,
        commissionRateBps: 10000,
        paymentDay: 5,
        status: "DRAFT",
      },
      create: {
        id: "seed-lt-contract-draft",
        propertyId: propertyOne.id,
        longTermListingId: listingOne.id,
        guestId: "seed-guest-1",
        status: "DRAFT",
        startDate: new Date(Date.UTC(2026, 10, 1)),
        monthlyRent: 65000,
        depositAmount: 65000,
        commissionRateBps: 10000,
        paymentDay: 5,
        notes: "Демо DRAFT — без платежей",
      },
    });

    const partial = await prisma.longTermContract.upsert({
      where: { id: "seed-lt-contract-partial" },
      update: {
        status: "ACTIVE",
        monthlyRent: 80000,
        depositAmount: 80000,
        commissionRateBps: 1800,
        paymentDay: 5,
      },
      create: {
        id: "seed-lt-contract-partial",
        propertyId: propertyThree.id,
        longTermListingId: listingThree.id,
        guestId: "seed-guest-2",
        status: "ACTIVE",
        startDate: new Date(Date.UTC(2026, 9, 1)),
        monthlyRent: 80000,
        depositAmount: 80000,
        commissionRateBps: 1800,
        paymentDay: 5,
        notes: "Демо ACTIVE — частичная оплата",
      },
    });

    await generateLongTermCharges(partial.id, {
      fromMonth: "2026-10",
      toMonth: "2026-10",
      includeDeposit: true,
    });

    if ((await prisma.longTermPayment.count({ where: { contractId: partial.id } })) === 0) {
      await recordLongTermPayment(partial.id, {
        amount: 50000,
        paidAt: new Date(Date.UTC(2026, 9, 5)),
        method: "перевод",
        note: "Частичная оплата (демо)",
      });
    }

    const paid = await prisma.longTermContract.upsert({
      where: { id: "seed-lt-contract-paid" },
      update: {
        status: "ACTIVE",
        monthlyRent: 40000,
        depositAmount: 0,
        commissionRateBps: 1500,
        paymentDay: 10,
      },
      create: {
        id: "seed-lt-contract-paid",
        propertyId: propertySix.id,
        guestId: "seed-guest-3",
        status: "ACTIVE",
        startDate: new Date(Date.UTC(2026, 8, 1)),
        monthlyRent: 40000,
        depositAmount: 0,
        commissionRateBps: 1500,
        paymentDay: 10,
        notes: "Демо ACTIVE — без долга",
      },
    });

    await generateLongTermCharges(paid.id, {
      fromMonth: "2026-09",
      toMonth: "2026-09",
    });

    if ((await prisma.longTermPayment.count({ where: { contractId: paid.id } })) === 0) {
      await recordLongTermPayment(paid.id, {
        amount: 40000,
        paidAt: new Date(Date.UTC(2026, 8, 10)),
        method: "наличные",
        note: "Полная оплата сентября (демо)",
      });
    }

    // Stage 12.4 — property economics demo (idempotent).
    await prisma.property.update({
      where: { id: propertyThree.id },
      data: { rentCollectionMode: "OWNER_DIRECT" },
    });

    const { createCommissionPayment } = await import("@/lib/finance/commission-finance");
    const { createManualExpense } = await import("@/lib/finance/service");

    // COMMISSION OWNER_DIRECT ST: guest payment without ledger; commission from owner.
    await ensureCommissionSnapshot("seed-booking-3");
    const ownerDirectPaymentId = "seed-booking-payment-owner-direct";
    await prisma.bookingPayment.upsert({
      where: { id: ownerDirectPaymentId },
      update: {
        amount: 8000,
        paidAt: new Date(Date.UTC(2026, 8, 11)),
        method: "перевод",
        note: "OWNER_DIRECT — не в кассу оператора",
      },
      create: {
        id: ownerDirectPaymentId,
        bookingId: "seed-booking-3",
        amount: 8000,
        paidAt: new Date(Date.UTC(2026, 8, 11)),
        method: "перевод",
        note: "OWNER_DIRECT — не в кассу оператора",
      },
    });
    await syncBookingPaymentTransaction(ownerDirectPaymentId);

    if (
      (await prisma.commissionPayment.count({ where: { bookingId: "seed-booking-3" } })) === 0
    ) {
      await createCommissionPayment({
        propertyId: propertyTwo.id,
        bookingId: "seed-booking-3",
        amount: 1600,
        paidAt: new Date(Date.UTC(2026, 8, 12)),
        method: "перевод",
        note: "20% комиссия от 8000 (демо)",
      });
    }

    // Operator expenses (property + global).
    if (
      (await prisma.financialTransaction.count({
        where: { propertyId: propertyOne.id, category: "ACQUIRING" },
      })) === 0
    ) {
      await createManualExpense({
        propertyId: propertyOne.id,
        amount: 1500,
        category: "ACQUIRING",
        occurredAt: new Date(Date.UTC(2026, 9, 1)),
        description: "Эквайринг (демо)",
      });
    }
    if (
      (await prisma.financialTransaction.count({
        where: { sourceKey: "SEED:EXPENSE:ADVERTISING" },
      })) === 0
    ) {
      await prisma.financialTransaction.create({
        data: {
          propertyId: null,
          type: "EXPENSE",
          category: "ADVERTISING",
          amount: 5000,
          economicRole: "BUSINESS_EXPENSE",
          expenseResponsibility: "OPERATOR",
          occurredAt: new Date(Date.UTC(2026, 9, 2)),
          description: "Общая реклама (демо)",
          sourceType: "MANUAL",
          sourceKey: "SEED:EXPENSE:ADVERTISING",
        },
      });
    }
  }

  // Stage 9.1 — минимальные SaleListing. Независимы от LongTermListing.
  await prisma.saleListing.upsert({
    where: { propertyId: propertyTwo.id },
    update: {
      status: "ACTIVE",
      price: 12500000,
      specialOfferPrice: 11900000,
      specialOfferText: "Спеццена при быстром выходе на сделку",
      marketingTitle: "Тестовая продажа — студия",
      description: "Рекламный текст продажи. Не описание объекта Property.",
      advantages: "Готов к показу",
      publicationContactName: "Демо-менеджер продаж",
      publicationPhoneCountryCode: "7",
      publicationPhoneNumber: "9005554433",
    },
    create: {
      propertyId: propertyTwo.id,
      status: "ACTIVE",
      price: 12500000,
      specialOfferPrice: 11900000,
      specialOfferText: "Спеццена при быстром выходе на сделку",
      marketingTitle: "Тестовая продажа — студия",
      description: "Рекламный текст продажи. Не описание объекта Property.",
      advantages: "Готов к показу",
      publicationContactName: "Демо-менеджер продаж",
      publicationPhoneCountryCode: "7",
      publicationPhoneNumber: "9005554433",
    },
  });

  await prisma.saleListing.upsert({
    where: { propertyId: propertyThree.id },
    update: {
      status: "DRAFT",
      price: 0,
      marketingTitle: "Тестовая продажа — черновик",
      description: "Черновик карточки продажи для CRM.",
    },
    create: {
      propertyId: propertyThree.id,
      status: "DRAFT",
      price: 0,
      marketingTitle: "Тестовая продажа — черновик",
      description: "Черновик карточки продажи для CRM.",
    },
  });

  const guestCount = await prisma.guest.count();
  const bookingCount = await prisma.booking.count();
  const saleListingCount = await prisma.saleListing.count();
  console.log(`Гостей в базе: ${guestCount}`);
  console.log(`Бронирований в базе: ${bookingCount}`);
  console.log(`Карточек продажи в базе: ${saleListingCount}`);

  const saleListingTwo = await prisma.saleListing.findUnique({
    where: { propertyId: propertyTwo.id },
  });
  const saleListingThree = await prisma.saleListing.findUnique({
    where: { propertyId: propertyThree.id },
  });

  // Stage 10.1 — NOT_PUBLISHED SalePublication for demo ACTIVE listing (no fake externalId).
  if (saleListingTwo) {
    const salePubChannels = await prisma.salesChannel.findMany({
      where: { code: { in: ["AVITO", "CIAN", "DOMCLICK"] } },
    });
    for (const channel of salePubChannels) {
      await prisma.salePublication.upsert({
        where: {
          saleListingId_salesChannelId: {
            saleListingId: saleListingTwo.id,
            salesChannelId: channel.id,
          },
        },
        update: {},
        create: {
          saleListingId: saleListingTwo.id,
          salesChannelId: channel.id,
          status: "NOT_PUBLISHED",
        },
      });
    }
  }

  if (saleListingTwo && saleListingThree) {
    const buyerA = await prisma.buyer.upsert({
      where: { id: "seed-buyer-1" },
      update: {
        name: "Тестовый покупатель А",
        phone: "+7 900 111-22-33",
        email: "buyer-a@example.test",
        messengerType: "TELEGRAM",
        messengerContact: "@buyer_a",
        notes: "Интересуется несколькими объектами",
      },
      create: {
        id: "seed-buyer-1",
        name: "Тестовый покупатель А",
        phone: "+7 900 111-22-33",
        email: "buyer-a@example.test",
        messengerType: "TELEGRAM",
        messengerContact: "@buyer_a",
        notes: "Интересуется несколькими объектами",
      },
    });

    const buyerB = await prisma.buyer.upsert({
      where: { id: "seed-buyer-2" },
      update: {
        name: "Тестовый покупатель Б",
        phone: "+7 900 444-55-66",
        email: "buyer-b@example.test",
        messengerType: "MAX",
        messengerContact: "buyer-b-max",
        notes: null,
      },
      create: {
        id: "seed-buyer-2",
        name: "Тестовый покупатель Б",
        phone: "+7 900 444-55-66",
        email: "buyer-b@example.test",
        messengerType: "MAX",
        messengerContact: "buyer-b-max",
        notes: null,
      },
    });

    await prisma.buyer.upsert({
      where: { id: "seed-buyer-3" },
      update: {
        name: "Тестовый покупатель В",
        phone: "+7 900 777-88-99",
        email: null,
        notes: "Пока без интереса",
      },
      create: {
        id: "seed-buyer-3",
        name: "Тестовый покупатель В",
        phone: "+7 900 777-88-99",
        email: null,
        notes: "Пока без интереса",
      },
    });

    await prisma.buyerInterest.upsert({
      where: {
        buyerId_saleListingId: {
          buyerId: buyerA.id,
          saleListingId: saleListingTwo.id,
        },
      },
      update: { status: "VIEWING_REQUESTED", notes: "Хочет посмотреть студию" },
      create: {
        id: "seed-buyer-interest-1",
        buyerId: buyerA.id,
        saleListingId: saleListingTwo.id,
        status: "VIEWING_REQUESTED",
        notes: "Хочет посмотреть студию",
      },
    });

    await prisma.buyerInterest.upsert({
      where: {
        buyerId_saleListingId: {
          buyerId: buyerA.id,
          saleListingId: saleListingThree.id,
        },
      },
      update: { status: "INTERESTED", notes: "Второй объект покупателя А" },
      create: {
        id: "seed-buyer-interest-2",
        buyerId: buyerA.id,
        saleListingId: saleListingThree.id,
        status: "INTERESTED",
        notes: "Второй объект покупателя А",
      },
    });

    await prisma.buyerInterest.upsert({
      where: {
        buyerId_saleListingId: {
          buyerId: buyerB.id,
          saleListingId: saleListingTwo.id,
        },
      },
      update: { status: "THINKING", notes: "Второй покупатель на ту же студию" },
      create: {
        id: "seed-buyer-interest-3",
        buyerId: buyerB.id,
        saleListingId: saleListingTwo.id,
        status: "THINKING",
        notes: "Второй покупатель на ту же студию",
      },
    });

    const interestA1 = await prisma.buyerInterest.findUniqueOrThrow({
      where: {
        buyerId_saleListingId: {
          buyerId: buyerA.id,
          saleListingId: saleListingTwo.id,
        },
      },
    });
    const interestA2 = await prisma.buyerInterest.findUniqueOrThrow({
      where: {
        buyerId_saleListingId: {
          buyerId: buyerA.id,
          saleListingId: saleListingThree.id,
        },
      },
    });

    await prisma.viewing.upsert({
      where: { id: "seed-viewing-1" },
      update: {
        buyerInterestId: interestA1.id,
        scheduledAt: new Date("2026-10-05T11:00:00.000Z"),
        status: "SCHEDULED",
        notes: "Первый показ студии",
      },
      create: {
        id: "seed-viewing-1",
        buyerInterestId: interestA1.id,
        scheduledAt: new Date("2026-10-05T11:00:00.000Z"),
        status: "SCHEDULED",
        notes: "Первый показ студии",
      },
    });

    await prisma.buyerInterest.update({
      where: { id: interestA1.id },
      data: { status: "VIEWING_SCHEDULED" },
    });

    await prisma.viewing.upsert({
      where: { id: "seed-viewing-2" },
      update: {
        buyerInterestId: interestA2.id,
        scheduledAt: new Date("2026-09-10T10:00:00.000Z"),
        status: "CANCELLED",
        notes: "Отменённый показ",
      },
      create: {
        id: "seed-viewing-2",
        buyerInterestId: interestA2.id,
        scheduledAt: new Date("2026-09-10T10:00:00.000Z"),
        status: "CANCELLED",
        notes: "Отменённый показ",
      },
    });

    await prisma.deposit.upsert({
      where: { id: "seed-deposit-1" },
      update: {
        buyerInterestId: interestA1.id,
        amount: 200000,
        status: "PENDING",
        paidAt: null,
        notes: "Демо-задаток (не оплачен)",
      },
      create: {
        id: "seed-deposit-1",
        buyerInterestId: interestA1.id,
        amount: 200000,
        status: "PENDING",
        notes: "Демо-задаток (не оплачен)",
      },
    });
  }

  const buyerCount = await prisma.buyer.count();
  const interestCount = await prisma.buyerInterest.count();
  const viewingCount = await prisma.viewing.count();
  const depositCount = await prisma.deposit.count();
  console.log(`Покупателей в базе: ${buyerCount}`);
  console.log(`Интересов в базе: ${interestCount}`);
  console.log(`Показов в базе: ${viewingCount}`);
  console.log(`Задатков в базе: ${depositCount}`);

  const channelRows = await prisma.salesChannel.findMany({
    orderBy: { code: "asc" },
    select: { code: true, name: true },
  });

  console.log(`Каналов продаж в базе: ${channelRows.length}`);
  for (const channel of channelRows) {
    console.log(`- ${channel.code}: ${channel.name}`);
  }

  const rows = await prisma.property.findMany({
    orderBy: { slug: "asc" },
    select: { slug: true, name: true, city: true, status: true },
  });

  console.log(`Seed завершён. Объектов в базе: ${rows.length}`);
  for (const row of rows) {
    console.log(`- ${row.slug}: ${row.name} (${row.city}, ${row.status})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
