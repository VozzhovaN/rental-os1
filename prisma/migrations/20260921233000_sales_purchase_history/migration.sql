-- CreateTable
CREATE TABLE "BuyerHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buyerId" TEXT NOT NULL,
    "buyerInterestId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BuyerHistory_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BuyerHistory_buyerInterestId_fkey" FOREIGN KEY ("buyerInterestId") REFERENCES "BuyerInterest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BuyerHistory_buyerId_createdAt_idx" ON "BuyerHistory"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "BuyerHistory_buyerInterestId_idx" ON "BuyerHistory"("buyerInterestId");

-- CreateIndex
CREATE INDEX "BuyerHistory_type_idx" ON "BuyerHistory"("type");
