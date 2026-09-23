-- CreateTable
CREATE TABLE "SalesChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChannelListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "salesChannelId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "syncStatus" TEXT NOT NULL DEFAULT 'CONNECTED',
    "lastSyncAt" DATETIME,
    "syncError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChannelListing_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChannelListing_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesChannel_code_key" ON "SalesChannel"("code");

-- CreateIndex
CREATE INDEX "ChannelListing_propertyId_idx" ON "ChannelListing"("propertyId");

-- CreateIndex
CREATE INDEX "ChannelListing_salesChannelId_idx" ON "ChannelListing"("salesChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelListing_propertyId_salesChannelId_key" ON "ChannelListing"("propertyId", "salesChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelListing_salesChannelId_externalId_key" ON "ChannelListing"("salesChannelId", "externalId");
