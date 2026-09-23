import type { BookingStatus, Prisma } from "@prisma/client";
import { createGuestHistory } from "@/lib/guest-history";
import { findOrCreateImportedGuest } from "@/lib/integrations/import-guest";
import { finishSyncLog, startSyncLog } from "@/lib/integrations/sync-log";
import type { ExternalBookingRecord } from "@/lib/integrations/types";
import { IntegrationError } from "@/lib/integrations/types";
import { formatDate, parseDateOnly, toDateInputValue } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const OCCUPYING: BookingStatus[] = ["PENDING", "CONFIRMED", "COMPLETED"];

function mapExternalStatus(status: ExternalBookingRecord["status"]): BookingStatus {
  if (status === "canceled") {
    return "CANCELLED";
  }

  if (status === "pending") {
    return "PENDING";
  }

  return "CONFIRMED";
}

function toUtcDate(value: string, field: string) {
  const date = parseDateOnly(value);

  if (!date) {
    throw new IntegrationError(`Некорректная дата ${field} во внешней брони.`, "VALIDATION");
  }

  return date;
}

function historyDescription(propertyName: string, checkIn: Date, checkOut: Date) {
  return [
    "Источник: Авито",
    `Объект: ${propertyName}`,
    `${formatDate(checkIn)}–${formatDate(checkOut)}`,
  ].join("\n");
}

function conflictMessage(propertyName: string, checkIn: Date, checkOut: Date) {
  return `Обнаружен конфликт бронирования. Объект: ${propertyName}. Даты: ${formatDate(checkIn)}–${formatDate(checkOut)}. Требуется ручная проверка.`;
}

export async function importExternalBooking(input: {
  connectionId: string;
  salesChannelId: string;
  propertyId: string;
  propertyName: string;
  channelListingId: string;
  record: ExternalBookingRecord;
}): Promise<"imported" | "updated" | "skipped" | "error"> {
  const log = await startSyncLog({
    connectionId: input.connectionId,
    direction: "IMPORT",
    entityType: "BOOKING",
    externalId: input.record.externalId,
  });

  try {
    const checkIn = toUtcDate(input.record.checkIn, "checkIn");
    const checkOut = toUtcDate(input.record.checkOut, "checkOut");
    const nextStatus = mapExternalStatus(input.record.status);
    const rawData = input.record.raw as Prisma.InputJsonValue;

    const result = await prisma.$transaction(async (tx) => {
      const existingMap = await tx.externalBooking.findUnique({
        where: {
          salesChannelId_externalId: {
            salesChannelId: input.salesChannelId,
            externalId: input.record.externalId,
          },
        },
        include: { booking: true },
      });

      const overlapping = await tx.booking.findFirst({
        where: {
          propertyId: input.propertyId,
          id: existingMap ? { not: existingMap.bookingId } : undefined,
          status: { in: OCCUPYING },
          checkIn: { lt: checkOut },
          checkOut: { gt: checkIn },
        },
      });

      if (overlapping && OCCUPYING.includes(nextStatus)) {
        throw new IntegrationError(
          conflictMessage(input.propertyName, checkIn, checkOut),
          "CONFLICT",
        );
      }

      if (existingMap) {
        const previousStatus = existingMap.booking.status;
        await tx.booking.update({
          where: { id: existingMap.bookingId },
          data: {
            checkIn,
            checkOut,
            guestsCount: Math.max(1, input.record.guestsCount),
            totalAmount: Math.max(0, Math.round(input.record.totalAmount)),
            status: nextStatus,
            salesChannelId: input.salesChannelId,
            channelListingId: input.channelListingId,
          },
        });
        await tx.externalBooking.update({
          where: { id: existingMap.id },
          data: {
            externalStatus: input.record.status,
            rawData,
          },
        });

        const historyType =
          nextStatus === "CANCELLED" && previousStatus !== "CANCELLED"
            ? "BOOKING_CANCELLED"
            : "BOOKING_UPDATED";

        await createGuestHistory(
          {
            guestId: existingMap.booking.guestId,
            type: historyType,
            title:
              historyType === "BOOKING_CANCELLED"
                ? "Бронирование отменено"
                : "Бронирование изменено",
            description: historyDescription(input.propertyName, checkIn, checkOut),
          },
          tx,
        );

        return "updated" as const;
      }

      const resolvedGuest = await findOrCreateImportedGuest(
        tx,
        input.record.guest,
        input.salesChannelId,
      );

      const booking = await tx.booking.create({
        data: {
          propertyId: input.propertyId,
          guestId: resolvedGuest.guest.id,
          salesChannelId: input.salesChannelId,
          channelListingId: input.channelListingId,
          checkIn,
          checkOut,
          guestsCount: Math.max(1, input.record.guestsCount),
          totalAmount: Math.max(0, Math.round(input.record.totalAmount)),
          status: nextStatus,
          comment: "Импортировано из Авито",
        },
      });

      await tx.externalBooking.create({
        data: {
          bookingId: booking.id,
          salesChannelId: input.salesChannelId,
          externalId: input.record.externalId,
          externalStatus: input.record.status,
          rawData,
        },
      });

      await createGuestHistory(
        {
          guestId: resolvedGuest.guest.id,
          type: "BOOKING_CREATED",
          title: "Бронирование создано",
          description: historyDescription(input.propertyName, checkIn, checkOut),
        },
        tx,
      );

      return "imported" as const;
    });

    await finishSyncLog(log.id, {
      status: "SUCCESS",
      metadata: { source: "AVITO", result },
    });

    return result;
  } catch (error) {
    const message =
      error instanceof IntegrationError
        ? error.message
        : "Не удалось импортировать бронирование Авито.";
    await finishSyncLog(log.id, {
      status: "ERROR",
      errorCode: error instanceof IntegrationError ? error.code : "UPSTREAM",
      errorMessage: message,
      metadata: { source: "AVITO" },
    });
    return "error";
  }
}

export function occupancyWindow() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 12);
  return {
    dateStart: toDateInputValue(start),
    dateEnd: toDateInputValue(end),
  };
}
