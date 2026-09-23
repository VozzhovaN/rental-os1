-- AlterTable
ALTER TABLE "FinancialTransaction" ADD COLUMN "longTermContractId" TEXT;

-- CreateIndex
CREATE INDEX "FinancialTransaction_longTermContractId_occurredAt_idx" ON "FinancialTransaction"("longTermContractId", "occurredAt");

-- CreateTable
CREATE TABLE "LongTermContract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "longTermListingId" TEXT,
    "guestId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "monthlyRent" INTEGER NOT NULL,
    "depositAmount" INTEGER NOT NULL DEFAULT 0,
    "commissionRateBps" INTEGER NOT NULL,
    "paymentDay" INTEGER NOT NULL,
    "prorationMode" TEXT NOT NULL DEFAULT 'MANUAL_FIRST_PERIOD',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LongTermContract_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LongTermContract_longTermListingId_fkey" FOREIGN KEY ("longTermListingId") REFERENCES "LongTermListing" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LongTermContract_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LongTermCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "periodStart" DATETIME,
    "periodEnd" DATETIME,
    "dueDate" DATETIME NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "sourceKey" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LongTermCharge_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "LongTermContract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LongTermPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAt" DATETIME NOT NULL,
    "method" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LongTermPayment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "LongTermContract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LongTermPaymentAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LongTermPaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "LongTermPayment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LongTermPaymentAllocation_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "LongTermCharge" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LongTermContract_propertyId_status_idx" ON "LongTermContract"("propertyId", "status");

-- CreateIndex
CREATE INDEX "LongTermContract_guestId_idx" ON "LongTermContract"("guestId");

-- CreateIndex
CREATE INDEX "LongTermContract_status_startDate_idx" ON "LongTermContract"("status", "startDate");

-- CreateIndex
CREATE INDEX "LongTermContract_longTermListingId_idx" ON "LongTermContract"("longTermListingId");

-- CreateIndex
CREATE UNIQUE INDEX "LongTermCharge_sourceKey_key" ON "LongTermCharge"("sourceKey");

-- CreateIndex
CREATE INDEX "LongTermCharge_contractId_dueDate_idx" ON "LongTermCharge"("contractId", "dueDate");

-- CreateIndex
CREATE INDEX "LongTermCharge_contractId_status_idx" ON "LongTermCharge"("contractId", "status");

-- CreateIndex
CREATE INDEX "LongTermCharge_type_dueDate_idx" ON "LongTermCharge"("type", "dueDate");

-- CreateIndex
CREATE INDEX "LongTermPayment_contractId_paidAt_idx" ON "LongTermPayment"("contractId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "LongTermPaymentAllocation_paymentId_chargeId_key" ON "LongTermPaymentAllocation"("paymentId", "chargeId");

-- CreateIndex
CREATE INDEX "LongTermPaymentAllocation_chargeId_idx" ON "LongTermPaymentAllocation"("chargeId");
