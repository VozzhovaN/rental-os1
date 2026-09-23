-- CreateTable
CREATE TABLE "FinancialTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "bookingId" TEXT,
    "longTermListingId" TEXT,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "adjustmentDirection" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "description" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialTransaction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinancialTransaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinancialTransaction_longTermListingId_fkey" FOREIGN KEY ("longTermListingId") REFERENCES "LongTermListing" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialTransaction_sourceKey_key" ON "FinancialTransaction"("sourceKey");

-- CreateIndex
CREATE INDEX "FinancialTransaction_propertyId_occurredAt_idx" ON "FinancialTransaction"("propertyId", "occurredAt");

-- CreateIndex
CREATE INDEX "FinancialTransaction_type_occurredAt_idx" ON "FinancialTransaction"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "FinancialTransaction_category_occurredAt_idx" ON "FinancialTransaction"("category", "occurredAt");

-- CreateIndex
CREATE INDEX "FinancialTransaction_sourceType_sourceId_idx" ON "FinancialTransaction"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "FinancialTransaction_occurredAt_idx" ON "FinancialTransaction"("occurredAt");
