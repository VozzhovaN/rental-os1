import type { IntegrationStatus } from "@prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/integrations/crypto";
import { isMockAvito } from "@/lib/integrations/mock-guard";
import { prisma } from "@/lib/prisma";
import { getSalesChannelByCode } from "@/lib/sales-channels";

export async function getAvitoChannel() {
  const channel = await getSalesChannelByCode("AVITO");

  if (!channel) {
    throw new Error("Канал AVITO не найден. Запустите seed.");
  }

  return channel;
}

export async function getAvitoConnection() {
  const channel = await getAvitoChannel();
  return prisma.integrationConnection.findUnique({
    where: { salesChannelId: channel.id },
  });
}

export async function upsertAvitoConnection(data: {
  status?: IntegrationStatus;
  providerAccountId?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  lastSyncAt?: Date | null;
  lastSuccessAt?: Date | null;
  lastErrorAt?: Date | null;
  lastError?: string | null;
}) {
  const channel = await getAvitoChannel();
  const current = await getAvitoConnection();
  const payload = {
    status: data.status,
    providerAccountId: data.providerAccountId,
    accessToken:
      data.accessToken === undefined ? undefined : encryptSecret(data.accessToken),
    refreshToken:
      data.refreshToken === undefined ? undefined : encryptSecret(data.refreshToken),
    tokenExpiresAt: data.tokenExpiresAt,
    lastSyncAt: data.lastSyncAt,
    lastSuccessAt: data.lastSuccessAt,
    lastErrorAt: data.lastErrorAt,
    lastError: data.lastError,
  };

  if (!current) {
    return prisma.integrationConnection.create({
      data: {
        salesChannelId: channel.id,
        status: data.status ?? "DISCONNECTED",
        providerAccountId: data.providerAccountId ?? null,
        accessToken: encryptSecret(data.accessToken),
        refreshToken: encryptSecret(data.refreshToken),
        tokenExpiresAt: data.tokenExpiresAt ?? null,
        lastError: data.lastError ?? null,
      },
    });
  }

  return prisma.integrationConnection.update({
    where: { id: current.id },
    data: payload,
  });
}

export function connectionTokens(connection: {
  accessToken: string | null;
  refreshToken: string | null;
}) {
  return {
    accessToken: decryptSecret(connection.accessToken),
    refreshToken: decryptSecret(connection.refreshToken),
  };
}

export function serializeConnectionPublic(connection: {
  status: IntegrationStatus;
  providerAccountId: string | null;
  accessToken?: string | null;
  lastSyncAt: Date | null;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastError: string | null;
} | null) {
  const status = connection?.status ?? "DISCONNECTED";
  const hasToken = Boolean(connection?.accessToken);
  const connected =
    (status === "CONNECTED" || status === "SYNCING") && (hasToken || isMockAvito());

  return {
    provider: "AVITO",
    status,
    accountId: connection?.providerAccountId ?? null,
    lastSyncAt: connection?.lastSyncAt?.toISOString() ?? null,
    lastSuccessAt: connection?.lastSuccessAt?.toISOString() ?? null,
    lastErrorAt: connection?.lastErrorAt?.toISOString() ?? null,
    lastError: connection?.lastError ?? null,
    connected,
  };
}
