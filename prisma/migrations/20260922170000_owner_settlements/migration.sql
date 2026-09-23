-- CreateTable
CREATE TABLE "Owner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OwnerSettlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    CONSTRAINT "OwnerSettlement_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OwnerPayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAt" DATETIME NOT NULL,
    "method" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OwnerPayout_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OwnerPayoutAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerPayoutId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OwnerPayoutAllocation_ownerPayoutId_fkey" FOREIGN KEY ("ownerPayoutId") REFERENCES "OwnerPayout" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OwnerPayoutAllocation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Property" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "area" REAL NOT NULL,
    "rooms" INTEGER NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" INTEGER NOT NULL,
    "floor" INTEGER,
    "totalFloors" INTEGER,
    "guests" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "ownerPhone" TEXT NOT NULL,
    "ownerId" TEXT,
    "managementType" TEXT NOT NULL,
    "dailyPrice" INTEGER,
    "monthlyPrice" INTEGER,
    "commissionDaily" REAL,
    "commissionMonthly" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Property" ("id", "name", "slug", "type", "status", "address", "city", "district", "area", "rooms", "bedrooms", "bathrooms", "floor", "totalFloors", "guests", "description", "shortDescription", "ownerName", "ownerPhone", "managementType", "dailyPrice", "monthlyPrice", "commissionDaily", "commissionMonthly", "createdAt", "updatedAt")
SELECT "id", "name", "slug", "type", "status", "address", "city", "district", "area", "rooms", "bedrooms", "bathrooms", "floor", "totalFloors", "guests", "description", "shortDescription", "ownerName", "ownerPhone", "managementType", "dailyPrice", "monthlyPrice", "commissionDaily", "commissionMonthly", "createdAt", "updatedAt" FROM "Property";
DROP TABLE "Property";
ALTER TABLE "new_Property" RENAME TO "Property";
CREATE UNIQUE INDEX "Property_slug_key" ON "Property"("slug");
CREATE INDEX "Property_status_idx" ON "Property"("status");
CREATE INDEX "Property_city_idx" ON "Property"("city");
CREATE INDEX "Property_type_idx" ON "Property"("type");
CREATE INDEX "Property_managementType_idx" ON "Property"("managementType");
CREATE INDEX "Property_ownerId_idx" ON "Property"("ownerId");

CREATE TABLE "new_FinancialTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "bookingId" TEXT,
    "longTermListingId" TEXT,
    "longTermContractId" TEXT,
    "ownerId" TEXT,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "adjustmentDirection" TEXT,
    "expenseResponsibility" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "description" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialTransaction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinancialTransaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinancialTransaction_longTermListingId_fkey" FOREIGN KEY ("longTermListingId") REFERENCES "LongTermListing" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinancialTransaction_longTermContractId_fkey" FOREIGN KEY ("longTermContractId") REFERENCES "LongTermContract" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinancialTransaction_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FinancialTransaction" ("id", "propertyId", "bookingId", "longTermListingId", "longTermContractId", "type", "category", "amount", "currency", "adjustmentDirection", "occurredAt", "description", "sourceType", "sourceId", "sourceKey", "createdAt")
SELECT "id", "propertyId", "bookingId", "longTermListingId", "longTermContractId", "type", "category", "amount", "currency", "adjustmentDirection", "occurredAt", "description", "sourceType", "sourceId", "sourceKey", "createdAt" FROM "FinancialTransaction";
DROP TABLE "FinancialTransaction";
ALTER TABLE "new_FinancialTransaction" RENAME TO "FinancialTransaction";
CREATE UNIQUE INDEX "FinancialTransaction_sourceKey_key" ON "FinancialTransaction"("sourceKey");
CREATE INDEX "FinancialTransaction_propertyId_occurredAt_idx" ON "FinancialTransaction"("propertyId", "occurredAt");
CREATE INDEX "FinancialTransaction_type_occurredAt_idx" ON "FinancialTransaction"("type", "occurredAt");
CREATE INDEX "FinancialTransaction_category_occurredAt_idx" ON "FinancialTransaction"("category", "occurredAt");
CREATE INDEX "FinancialTransaction_sourceType_sourceId_idx" ON "FinancialTransaction"("sourceType", "sourceId");
CREATE INDEX "FinancialTransaction_occurredAt_idx" ON "FinancialTransaction"("occurredAt");
CREATE INDEX "FinancialTransaction_longTermContractId_occurredAt_idx" ON "FinancialTransaction"("longTermContractId", "occurredAt");
CREATE INDEX "FinancialTransaction_ownerId_occurredAt_idx" ON "FinancialTransaction"("ownerId", "occurredAt");
CREATE INDEX "FinancialTransaction_expenseResponsibility_occurredAt_idx" ON "FinancialTransaction"("expenseResponsibility", "occurredAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Owner_isActive_idx" ON "Owner"("isActive");
CREATE INDEX "Owner_name_idx" ON "Owner"("name");
CREATE INDEX "OwnerSettlement_ownerId_periodStart_periodEnd_idx" ON "OwnerSettlement"("ownerId", "periodStart", "periodEnd");
CREATE INDEX "OwnerSettlement_ownerId_status_idx" ON "OwnerSettlement"("ownerId", "status");
CREATE INDEX "OwnerPayout_ownerId_paidAt_idx" ON "OwnerPayout"("ownerId", "paidAt");
CREATE UNIQUE INDEX "OwnerPayoutAllocation_ownerPayoutId_propertyId_key" ON "OwnerPayoutAllocation"("ownerPayoutId", "propertyId");
CREATE INDEX "OwnerPayoutAllocation_propertyId_idx" ON "OwnerPayoutAllocation"("propertyId");
