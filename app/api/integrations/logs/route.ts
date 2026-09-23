import type { SyncEntityType, SyncLogStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSyncLogs } from "@/lib/integrations/sync-log";
import { withApiAuth } from "@/lib/auth/with-api-auth";

const STATUSES: SyncLogStatus[] = ["STARTED", "SUCCESS", "ERROR", "SKIPPED"];
const ENTITY_TYPES: SyncEntityType[] = ["LISTING", "BOOKING", "AVAILABILITY", "PRICE"];

export const GET = withApiAuth(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const entityType = searchParams.get("entityType");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const logs = await getSyncLogs({
    status: status && STATUSES.includes(status as SyncLogStatus) ? (status as SyncLogStatus) : undefined,
    entityType:
      entityType && ENTITY_TYPES.includes(entityType as SyncEntityType)
        ? (entityType as SyncEntityType)
        : undefined,
    channelCode: searchParams.get("channel") ?? undefined,
    from: from ? new Date(`${from}T00:00:00.000Z`) : undefined,
    to: to ? new Date(`${to}T23:59:59.999Z`) : undefined,
  });

  return NextResponse.json({
    logs: logs.map((log) => ({
      id: log.id,
      createdAt: log.createdAt.toISOString(),
      startedAt: log.startedAt.toISOString(),
      finishedAt: log.finishedAt?.toISOString() ?? null,
      channel: log.connection.salesChannel.name,
      channelCode: log.connection.salesChannel.code,
      direction: log.direction,
      entityType: log.entityType,
      status: log.status,
      externalId: log.externalId,
      errorCode: log.errorCode,
      errorMessage: log.errorMessage,
    })),
  });
});
