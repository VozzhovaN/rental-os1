-- Property economics pivot (Stage 12.4)

-- AlterTable: Property.rentCollectionMode
ALTER TABLE "Property" ADD COLUMN "rentCollectionMode" TEXT NOT NULL DEFAULT 'OPERATOR';

-- CreateTable: CommissionPayment
CREATE TABLE "CommissionPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "bookingId" TEXT,
    "longTermContractId" TEXT,
    "amount" INTEGER NOT NULL,
    "paidAt" DATETIME NOT NULL,
    "method" TEXT,
    "note" TEXT,
    "sourceKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommissionPayment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CommissionPayment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CommissionPayment_longTermContractId_fkey" FOREIGN KEY ("longTermContractId") REFERENCES "LongTermContract" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CommissionPayment_sourceKey_key" ON "CommissionPayment"("sourceKey");
CREATE INDEX "CommissionPayment_propertyId_paidAt_idx" ON "CommissionPayment"("propertyId", "paidAt");
CREATE INDEX "CommissionPayment_bookingId_idx" ON "CommissionPayment"("bookingId");
CREATE INDEX "CommissionPayment_longTermContractId_idx" ON "CommissionPayment"("longTermContractId");

-- AlterTable: FinancialTransaction — nullable propertyId + economicRole
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FinancialTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT,
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
    "economicRole" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "description" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialTransaction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinancialTransaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinancialTransaction_longTermListingId_fkey" FOREIGN KEY ("longTermListingId") REFERENCES "LongTermListing" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinancialTransaction_longTermContractId_fkey" FOREIGN KEY ("longTermContractId") REFERENCES "LongTermContract" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinancialTransaction_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FinancialTransaction" ("id", "propertyId", "bookingId", "longTermListingId", "longTermContractId", "ownerId", "type", "category", "amount", "currency", "adjustmentDirection", "expenseResponsibility", "economicRole", "occurredAt", "description", "sourceType", "sourceId", "sourceKey", "createdAt")
SELECT "id", "propertyId", "bookingId", "longTermListingId", "longTermContractId", "ownerId", "type", "category", "amount", "currency", "adjustmentDirection", "expenseResponsibility", NULL, "occurredAt", "description", "sourceType", "sourceId", "sourceKey", "createdAt" FROM "FinancialTransaction";
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

-- Backfill economicRole for existing ledger rows (join Property for OWN vs COMMISSION)
UPDATE "FinancialTransaction"
SET "economicRole" = 'BUSINESS_REVENUE'
WHERE "type" = 'INCOME'
  AND "category" = 'RENT_PAYMENT'
  AND "economicRole" IS NULL
  AND "propertyId" IN (SELECT "id" FROM "Property" WHERE "managementType" = 'OWN');

UPDATE "FinancialTransaction"
SET "economicRole" = 'PASS_THROUGH'
WHERE "type" = 'INCOME'
  AND "category" = 'RENT_PAYMENT'
  AND "economicRole" IS NULL
  AND "propertyId" IN (SELECT "id" FROM "Property" WHERE "managementType" = 'COMMISSION');

UPDATE "FinancialTransaction"
SET "economicRole" = 'BUSINESS_REVENUE'
WHERE "type" = 'INCOME'
  AND "category" = 'OPERATOR_COMMISSION'
  AND "economicRole" IS NULL;

UPDATE "FinancialTransaction"
SET "economicRole" = 'BUSINESS_EXPENSE'
WHERE "type" = 'EXPENSE'
  AND "category" NOT IN ('GUEST_REFUND', 'SECURITY_DEPOSIT_RETURNED')
  AND ("expenseResponsibility" IS NULL OR "expenseResponsibility" = 'OPERATOR')
  AND "economicRole" IS NULL;

UPDATE "FinancialTransaction"
SET "economicRole" = 'PASS_THROUGH'
WHERE "type" = 'EXPENSE'
  AND "category" = 'GUEST_REFUND'
  AND "economicRole" IS NULL;

UPDATE "FinancialTransaction"
SET "economicRole" = 'NEUTRAL'
WHERE "category" IN ('SECURITY_DEPOSIT_RECEIVED', 'SECURITY_DEPOSIT_RETURNED')
  AND "economicRole" IS NULL;
