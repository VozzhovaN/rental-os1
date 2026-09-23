-- AlterTable
ALTER TABLE "SaleListing" ADD COLUMN "publicationContactName" TEXT;
ALTER TABLE "SaleListing" ADD COLUMN "publicationPhoneCountryCode" TEXT;
ALTER TABLE "SaleListing" ADD COLUMN "publicationPhoneNumber" TEXT;

-- CreateTable
CREATE TABLE "SalePublication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleListingId" TEXT NOT NULL,
    "salesChannelId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_PUBLISHED',
    "externalId" TEXT,
    "externalStatus" TEXT,
    "lastAttemptAt" DATETIME,
    "lastSuccessAt" DATETIME,
    "lastErrorAt" DATETIME,
    "lastError" TEXT,
    "lastSerializedHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalePublication_saleListingId_fkey" FOREIGN KEY ("saleListingId") REFERENCES "SaleListing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SalePublication_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SalePublication_salesChannelId_idx" ON "SalePublication"("salesChannelId");

-- CreateIndex
CREATE INDEX "SalePublication_status_idx" ON "SalePublication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SalePublication_saleListingId_salesChannelId_key" ON "SalePublication"("saleListingId", "salesChannelId");
