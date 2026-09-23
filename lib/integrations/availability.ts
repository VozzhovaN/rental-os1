import { finishSyncLog, startSyncLog } from "@/lib/integrations/sync-log";
import { getAvitoAdapter } from "@/lib/integrations/adapters";
import { getAvitoChannel, getAvitoConnection, upsertAvitoConnection } from "@/lib/integrations/connections";
import { integrationLog } from "@/lib/integrations/logger";
import type { OccupancyInterval, SalesChannelAdapter } from "@/lib/integrations/types";
import { IntegrationError } from "@/lib/integrations/types";
import { toDateInputValue } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const OCCUPYING = ["PENDING", "CONFIRMED"] as const;

export async function exportAvailabilityForProperty(
  propertyId: string,
  adapter: SalesChannelAdapter = getAvitoAdapter(),
) {
  const started = Date.now();
  const channel = await getAvitoChannel();
  const listing = await prisma.channelListing.findFirst({
    where: {
      propertyId,
      salesChannelId: channel.id,
      status: "ACTIVE",
    },
    include: { property: { select: { name: true } } },
  });

  if (!listing) {
    return { skipped: true as const };
  }

  const connection = await getAvitoConnection();

  if (!connection || (connection.status !== "CONNECTED" && connection.status !== "SYNCING")) {
    return { skipped: true as const };
  }

  const log = await startSyncLog({
    connectionId: connection.id,
    direction: "EXPORT",
    entityType: "AVAILABILITY",
    externalId: listing.externalId,
  });

  try {
    const bookings = await prisma.booking.findMany({
      where: {
        propertyId,
        status: { in: [...OCCUPYING] },
        externalBookings: { none: { salesChannelId: channel.id } },
      },
    });

    const intervals: OccupancyInterval[] = bookings.map((booking) => ({
      dateStart: toDateInputValue(booking.checkIn),
      dateEnd: toDateInputValue(booking.checkOut),
      comment: `CRM ${listing.property.name}`,
    }));

    await adapter.pushAvailability({
      listingId: listing.externalId,
      intervals,
    });

    await prisma.channelListing.update({
      where: { id: listing.id },
      data: {
        syncStatus: "SYNCED",
        lastSyncAt: new Date(),
        syncError: null,
      },
    });

    await finishSyncLog(log.id, {
      status: "SUCCESS",
      metadata: { source: "CRM", intervals: intervals.length },
    });
    integrationLog({
      integration: "AVITO",
      operation: "pushAvailability",
      direction: "EXPORT",
      externalId: listing.externalId,
      status: "SUCCESS",
      durationMs: Date.now() - started,
    });
    return { skipped: false as const, intervals: intervals.length };
  } catch (error) {
    const message =
      error instanceof IntegrationError ? error.message : "Не удалось выгрузить занятость в Авито.";
    await prisma.channelListing.update({
      where: { id: listing.id },
      data: { syncStatus: "ERROR", syncError: message },
    });
    await finishSyncLog(log.id, {
      status: "ERROR",
      errorCode: error instanceof IntegrationError ? error.code : "UPSTREAM",
      errorMessage: message,
      metadata: { source: "CRM" },
    });
    await upsertAvitoConnection({
      lastError: message,
      lastErrorAt: new Date(),
    });
    integrationLog({
      integration: "AVITO",
      operation: "pushAvailability",
      direction: "EXPORT",
      externalId: listing.externalId,
      status: "ERROR",
      durationMs: Date.now() - started,
      errorCode: error instanceof IntegrationError ? error.code : "UPSTREAM",
    });
    return { skipped: false as const, error: message };
  }
}

export async function notifyCrmBookingChanged(propertyId: string) {
  try {
    await exportAvailabilityForProperty(propertyId);
  } catch {
    return;
  }
}
