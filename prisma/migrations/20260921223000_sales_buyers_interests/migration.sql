-- CreateTable
CREATE TABLE "Buyer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "messengerType" TEXT,
    "messengerContact" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BuyerInterest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buyerId" TEXT NOT NULL,
    "saleListingId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INTERESTED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BuyerInterest_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BuyerInterest_saleListingId_fkey" FOREIGN KEY ("saleListingId") REFERENCES "SaleListing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Buyer_name_idx" ON "Buyer"("name");

-- CreateIndex
CREATE INDEX "Buyer_phone_idx" ON "Buyer"("phone");

-- CreateIndex
CREATE INDEX "Buyer_email_idx" ON "Buyer"("email");

-- CreateIndex
CREATE INDEX "BuyerInterest_buyerId_idx" ON "BuyerInterest"("buyerId");

-- CreateIndex
CREATE INDEX "BuyerInterest_saleListingId_idx" ON "BuyerInterest"("saleListingId");

-- CreateIndex
CREATE INDEX "BuyerInterest_status_idx" ON "BuyerInterest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerInterest_buyerId_saleListingId_key" ON "BuyerInterest"("buyerId", "saleListingId");
