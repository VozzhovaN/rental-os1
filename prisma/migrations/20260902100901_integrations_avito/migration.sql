-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "salesChannelId" TEXT NOT NULL,
    "providerAccountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" DATETIME,
    "lastSyncAt" DATETIME,
    "lastSuccessAt" DATETIME,
    "lastErrorAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IntegrationConnection_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntegrationSyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "externalId" TEXT,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationSyncLog_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExternalBooking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "salesChannelId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalStatus" TEXT,
    "rawData" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExternalBooking_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExternalBooking_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_salesChannelId_key" ON "IntegrationConnection"("salesChannelId");

-- CreateIndex
CREATE INDEX "IntegrationSyncLog_connectionId_createdAt_idx" ON "IntegrationSyncLog"("connectionId", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationSyncLog_status_idx" ON "IntegrationSyncLog"("status");

-- CreateIndex
CREATE INDEX "IntegrationSyncLog_entityType_idx" ON "IntegrationSyncLog"("entityType");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalBooking_bookingId_key" ON "ExternalBooking"("bookingId");

-- CreateIndex
CREATE INDEX "ExternalBooking_salesChannelId_idx" ON "ExternalBooking"("salesChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalBooking_salesChannelId_externalId_key" ON "ExternalBooking"("salesChannelId", "externalId");
