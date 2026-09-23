-- CreateTable
CREATE TABLE "PropertyPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyPhoto_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LongTermListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "monthlyPrice" INTEGER NOT NULL DEFAULT 0,
    "specialOfferPrice" INTEGER,
    "specialOfferText" TEXT,
    "deposit" INTEGER NOT NULL DEFAULT 0,
    "commission" REAL NOT NULL DEFAULT 0,
    "minimumRentalPeriod" INTEGER NOT NULL DEFAULT 1,
    "marketingTitle" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "rentalTerms" TEXT NOT NULL DEFAULT '',
    "infrastructureDescription" TEXT NOT NULL DEFAULT '',
    "securityDescription" TEXT NOT NULL DEFAULT '',
    "parkingDescription" TEXT NOT NULL DEFAULT '',
    "transportDescription" TEXT NOT NULL DEFAULT '',
    "advantagesDescription" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LongTermListing_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LongTermListingPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "included" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "LongTermListingPhoto_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "LongTermListing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LongTermListingPhoto_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "PropertyPhoto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PropertyPhoto_propertyId_sortOrder_idx" ON "PropertyPhoto"("propertyId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LongTermListing_propertyId_key" ON "LongTermListing"("propertyId");

-- CreateIndex
CREATE INDEX "LongTermListing_status_idx" ON "LongTermListing"("status");

-- CreateIndex
CREATE INDEX "LongTermListingPhoto_listingId_sortOrder_idx" ON "LongTermListingPhoto"("listingId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LongTermListingPhoto_listingId_photoId_key" ON "LongTermListingPhoto"("listingId", "photoId");
