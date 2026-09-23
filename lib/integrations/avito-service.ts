import { getAvitoAdapter } from "@/lib/integrations/adapters";
import { exportAvailabilityForProperty } from "@/lib/integrations/availability";
import {
  getAvitoChannel,
  getAvitoConnection,
  serializeConnectionPublic,
  upsertAvitoConnection,
} from "@/lib/integrations/connections";
import { publicIntegrationMessage } from "@/lib/integrations/errors";
import { occupancyWindow, importExternalBooking } from "@/lib/integrations/import-booking";
import { integrationLog } from "@/lib/integrations/logger";
import { finishSyncLog, startSyncLog } from "@/lib/integrations/sync-log";
import type { SalesChannelAdapter, SyncBookingsResult } from "@/lib/integrations/types";
import { IntegrationError } from "@/lib/integrations/types";
import { prisma } from "@/lib/prisma";

function adapter() {
  return getAvitoAdapter();
}

async function requireConnection() {
  const connection = await getAvitoConnection();

  if (!connection) {
    throw new IntegrationError("Авито не подключено.", "NOT_CONNECTED");
  }

  return connection;
}

export async function getAvitoPublicStatus() {
  const connection = await getAvitoConnection();
  return serializeConnectionPublic(connection);
}

export async function connectAvito(input?: {
  code?: string;
  flow?: "oauth" | "client_credentials";
  state?: string;
}) {
  await upsertAvitoConnection({
    status: "CONNECTING",
    lastError: null,
  });

  const started = Date.now();

  try {
    const result = await adapter().connect(input);

    if (result.redirectUrl) {
      integrationLog({
        integration: "AVITO",
        operation: "connect",
        status: "STARTED",
        durationMs: Date.now() - started,
      });
      return result;
    }

    await upsertAvitoConnection({
      status: "CONNECTED",
      providerAccountId: result.accountId ?? null,
      lastSuccessAt: new Date(),
      lastError: null,
    });
    integrationLog({
      integration: "AVITO",
      operation: "connect",
      status: "SUCCESS",
      durationMs: Date.now() - started,
    });
    return result;
  } catch (error) {
    const message = publicIntegrationMessage(error);
    await upsertAvitoConnection({
      status: "ERROR",
      lastError: message,
      lastErrorAt: new Date(),
    });
    integrationLog({
      integration: "AVITO",
      operation: "connect",
      status: "ERROR",
      durationMs: Date.now() - started,
      errorCode: error instanceof IntegrationError ? error.code : "UPSTREAM",
    });
    throw error instanceof IntegrationError
      ? error
      : new IntegrationError(message, "UPSTREAM");
  }
}

export async function disconnectAvito() {
  await adapter().disconnect();
  await upsertAvitoConnection({
    status: "DISCONNECTED",
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
    providerAccountId: null,
    lastError: null,
  });

  // Keep ChannelListing rows (externalId mapping) but stop sync until reconnect.
  const channel = await getAvitoChannel();
  await prisma.channelListing.updateMany({
    where: { salesChannelId: channel.id, status: "ACTIVE" },
    data: { status: "INACTIVE", syncStatus: "NOT_CONNECTED" },
  });
}

export async function syncListings(client: SalesChannelAdapter = adapter()) {
  const connection = await requireConnection();
  const started = Date.now();
  const log = await startSyncLog({
    connectionId: connection.id,
    direction: "IMPORT",
    entityType: "LISTING",
  });

  try {
    const listings = await client.getListings();
    await finishSyncLog(log.id, {
      status: "SUCCESS",
      metadata: { source: "AVITO", count: listings.length },
    });
    integrationLog({
      integration: "AVITO",
      operation: "syncListings",
      direction: "IMPORT",
      status: "SUCCESS",
      durationMs: Date.now() - started,
    });
    return listings;
  } catch (error) {
    const message = publicIntegrationMessage(error);
    await finishSyncLog(log.id, {
      status: "ERROR",
      errorCode: error instanceof IntegrationError ? error.code : "UPSTREAM",
      errorMessage: message,
    });
    await upsertAvitoConnection({
      status: "ERROR",
      lastError: message,
      lastErrorAt: new Date(),
    });
    integrationLog({
      integration: "AVITO",
      operation: "syncListings",
      direction: "IMPORT",
      status: "ERROR",
      durationMs: Date.now() - started,
      errorCode: error instanceof IntegrationError ? error.code : "UPSTREAM",
    });
    throw error instanceof IntegrationError
      ? error
      : new IntegrationError(message, "UPSTREAM");
  }
}

export async function getAvitoListings(client: SalesChannelAdapter = adapter()) {
  return client.getListings();
}

export async function syncBookings(client: SalesChannelAdapter = adapter()): Promise<SyncBookingsResult> {
  const channel = await getAvitoChannel();
  const connection = await requireConnection();
  const listings = await prisma.channelListing.findMany({
    where: { salesChannelId: channel.id, status: "ACTIVE" },
    include: { property: { select: { id: true, name: true } } },
  });
  const window = occupancyWindow();
  const summary: SyncBookingsResult = { imported: 0, updated: 0, skipped: 0, errors: 0 };

  for (const listing of listings) {
    let listingErrors = 0;
    try {
      const records = await client.getBookings({
        listingId: listing.externalId,
        dateStart: window.dateStart,
        dateEnd: window.dateEnd,
      });

      for (const record of records) {
        const result = await importExternalBooking({
          connectionId: connection.id,
          salesChannelId: channel.id,
          propertyId: listing.property.id,
          propertyName: listing.property.name,
          channelListingId: listing.id,
          record,
        });

        if (result === "imported") {
          summary.imported += 1;
        } else if (result === "updated") {
          summary.updated += 1;
        } else if (result === "skipped") {
          summary.skipped += 1;
        } else {
          listingErrors += 1;
          summary.errors += 1;
        }
      }

      await prisma.channelListing.update({
        where: { id: listing.id },
        data: {
          syncStatus: listingErrors > 0 ? "ERROR" : "SYNCED",
          lastSyncAt: new Date(),
          syncError: listingErrors > 0 ? "Есть ошибки импорта броней" : null,
        },
      });
    } catch (error) {
      summary.errors += 1;
      await prisma.channelListing.update({
        where: { id: listing.id },
        data: {
          syncStatus: "ERROR",
          syncError: publicIntegrationMessage(error),
        },
      });
    }
  }

  return summary;
}

export async function syncAvailability(client: SalesChannelAdapter = adapter()) {
  const channel = await getAvitoChannel();
  const listings = await prisma.channelListing.findMany({
    where: { salesChannelId: channel.id, status: "ACTIVE" },
  });
  let exported = 0;
  let errors = 0;

  for (const listing of listings) {
    const result = await exportAvailabilityForProperty(listing.propertyId, client);
    if (result.skipped) {
      continue;
    }
    if ("error" in result && result.error) {
      errors += 1;
    } else {
      exported += 1;
    }
  }

  return { exported, errors };
}

export async function syncListing(
  propertyId: string,
  listingId: string,
  client: SalesChannelAdapter = adapter(),
) {
  const channel = await getAvitoChannel();
  const listing = await prisma.channelListing.findFirst({
    where: { id: listingId, propertyId, salesChannelId: channel.id },
    include: { property: { select: { id: true, name: true } } },
  });

  if (!listing) {
    throw new IntegrationError("Привязка Авито не найдена.", "VALIDATION");
  }

  if (listing.status !== "ACTIVE") {
    throw new IntegrationError("Объект отключён от Авито.", "VALIDATION");
  }

  const connection = await requireConnection();
  const window = occupancyWindow();
  const records = await client.getBookings({
    listingId: listing.externalId,
    dateStart: window.dateStart,
    dateEnd: window.dateEnd,
  });
  const summary: SyncBookingsResult = { imported: 0, updated: 0, skipped: 0, errors: 0 };

  for (const record of records) {
    const result = await importExternalBooking({
      connectionId: connection.id,
      salesChannelId: channel.id,
      propertyId: listing.property.id,
      propertyName: listing.property.name,
      channelListingId: listing.id,
      record,
    });
    summary[result === "error" ? "errors" : result] += 1;
  }

  const availability = await exportAvailabilityForProperty(propertyId, client);
  return { bookings: summary, availability };
}

export async function syncAvito(client: SalesChannelAdapter = adapter()) {
  await requireConnection();
  await upsertAvitoConnection({ status: "SYNCING", lastError: null });

  const result = {
    listings: 0,
    imported: 0,
    updated: 0,
    errors: 0,
    availabilityExported: 0,
  };

  try {
    try {
      const listings = await syncListings(client);
      result.listings = listings.length;
    } catch {
      result.errors += 1;
    }

    try {
      const bookings = await syncBookings(client);
      result.imported = bookings.imported;
      result.updated = bookings.updated;
      result.errors += bookings.errors;
    } catch {
      result.errors += 1;
    }

    try {
      const availability = await syncAvailability(client);
      result.availabilityExported = availability.exported;
      result.errors += availability.errors;
    } catch {
      result.errors += 1;
    }

    await upsertAvitoConnection({
      status: result.errors > 0 ? "ERROR" : "CONNECTED",
      lastSyncAt: new Date(),
      lastSuccessAt: result.errors > 0 ? undefined : new Date(),
      lastError: result.errors > 0 ? "Синхронизация завершена с ошибками" : null,
      lastErrorAt: result.errors > 0 ? new Date() : undefined,
    });

    return result;
  } catch (error) {
    await upsertAvitoConnection({
      status: "ERROR",
      lastError: publicIntegrationMessage(error),
      lastErrorAt: new Date(),
    });
    throw error;
  } finally {
    const current = await getAvitoConnection();
    if (current?.status === "SYNCING") {
      await upsertAvitoConnection({ status: "CONNECTED" });
    }
  }
}
