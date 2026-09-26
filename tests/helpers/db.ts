import { execSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { prisma } from "@/lib/prisma";

let prepared = false;
const lockPath = "prisma/.test-db.lock";

export async function prepareTestDatabase() {
  if (prepared) {
    return;
  }

  const started = Date.now();
  while (existsSync(lockPath) && Date.now() - started < 60_000) {
    await sleep(250);
  }

  writeFileSync(lockPath, String(process.pid));

  try {
    execSync("npx prisma db push --skip-generate", {
      stdio: "inherit",
      env: process.env,
    });
  } catch (error) {
    const message = String(error);
    if (!message.includes("already exists")) {
      throw error;
    }
  } finally {
    try {
      rmSync(lockPath, { force: true });
    } catch {
      // ignore
    }
  }

  prepared = true;
}

export async function resetFixtures() {
  await prisma.publication.deleteMany();
  await prisma.salePublication.deleteMany();
  await prisma.presentationSection.deleteMany();
  await prisma.presentationItemPhoto.deleteMany();
  await prisma.presentationItem.deleteMany();
  await prisma.presentation.deleteMany();
  await prisma.financialTransaction.deleteMany();
  await prisma.commissionPayment.deleteMany();
  await prisma.longTermPaymentAllocation.deleteMany();
  await prisma.longTermPayment.deleteMany();
  await prisma.longTermCharge.deleteMany();
  await prisma.longTermContract.deleteMany();
  await prisma.bookingPaymentRefund.deleteMany();
  await prisma.bookingPayment.deleteMany();
  await prisma.externalBooking.deleteMany();
  await prisma.integrationSyncLog.deleteMany();
  await prisma.integrationConnection.deleteMany();
  await prisma.viewing.deleteMany();
  await prisma.deposit.deleteMany();
  await prisma.buyerHistory.deleteMany();
  await prisma.buyerInterest.deleteMany();
  await prisma.buyer.deleteMany();
  await prisma.saleListingPhoto.deleteMany();
  await prisma.longTermListingPhoto.deleteMany();
  await prisma.propertyPhoto.deleteMany();
  await prisma.saleListing.deleteMany();
  await prisma.longTermListing.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.guestHistory.deleteMany();
  await prisma.channelListing.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.ownerPayoutAllocation.deleteMany();
  await prisma.ownerPayout.deleteMany();
  await prisma.ownerSettlement.deleteMany();
  await prisma.propertyDayPrice.deleteMany();
  await prisma.property.deleteMany();
  await prisma.owner.deleteMany();
  await prisma.salesChannel.deleteMany();

  const channel = await prisma.salesChannel.create({
    data: { code: "AVITO", name: "Авито", isActive: true },
  });
  const property = await prisma.property.create({
    data: {
      name: "Тестовый объект 1",
      slug: `test-object-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: "APARTMENT",
      status: "ACTIVE",
      address: "ул. Тестовая, д. 1",
      city: "Тестовый город",
      district: "Район А",
      area: 42,
      rooms: 1,
      bedrooms: 1,
      bathrooms: 1,
      guests: 4,
      description: "Тест",
      shortDescription: "Тест",
      ownerName: "Владелец",
      ownerPhone: "+7 000 000-00-01",
      managementType: "OWN",
    },
  });

  return { channel, property };
}
