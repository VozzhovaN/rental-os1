-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "longTermListingId" TEXT NOT NULL,
    "salesChannelId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_PUBLISHED',
    "externalId" TEXT,
    "externalStatus" TEXT,
    "lastSyncAt" DATETIME,
    "lastSuccessAt" DATETIME,
    "lastErrorAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Publication_longTermListingId_fkey" FOREIGN KEY ("longTermListingId") REFERENCES "LongTermListing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Publication_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Publication_longTermListingId_salesChannelId_key" ON "Publication"("longTermListingId", "salesChannelId");

-- CreateIndex
CREATE INDEX "Publication_salesChannelId_idx" ON "Publication"("salesChannelId");

-- CreateIndex
CREATE INDEX "Publication_status_idx" ON "Publication"("status");
