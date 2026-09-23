import type { Prisma, SyncDirection, SyncEntityType, SyncLogStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function startSyncLog(input: {
  connectionId: string;
  direction: SyncDirection;
  entityType: SyncEntityType;
  externalId?: string | null;
}) {
  return prisma.integrationSyncLog.create({
    data: {
      connectionId: input.connectionId,
      direction: input.direction,
      entityType: input.entityType,
      status: "STARTED",
      externalId: input.externalId ?? null,
      startedAt: new Date(),
    },
  });
}

export async function finishSyncLog(
  id: string,
  input: {
    status: Exclude<SyncLogStatus, "STARTED">;
    errorCode?: string | null;
    errorMessage?: string | null;
    metadata?: Prisma.InputJsonValue;
    externalId?: string | null;
  },
) {
  return prisma.integrationSyncLog.update({
    where: { id },
    data: {
      status: input.status,
      finishedAt: new Date(),
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      metadata: input.metadata,
      externalId: input.externalId,
    },
  });
}

export async function getSyncLogs(filters: {
  status?: SyncLogStatus;
  entityType?: SyncEntityType;
  channelCode?: string;
  from?: Date;
  to?: Date;
}) {
  return prisma.integrationSyncLog.findMany({
    where: {
      status: filters.status,
      entityType: filters.entityType,
      createdAt: {
        gte: filters.from,
        lte: filters.to,
      },
      connection: filters.channelCode
        ? { salesChannel: { code: filters.channelCode } }
        : undefined,
    },
    include: {
      connection: {
        include: { salesChannel: { select: { code: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
