-- CreateTable
CREATE TABLE "SaleListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "price" INTEGER NOT NULL DEFAULT 0,
    "marketingTitle" TEXT,
    "description" TEXT,
    "specialOfferPrice" INTEGER,
    "specialOfferText" TEXT,
    "advantages" TEXT,
    "infrastructure" TEXT,
    "security" TEXT,
    "parking" TEXT,
    "transport" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SaleListing_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SaleListingPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleListingId" TEXT NOT NULL,
    "propertyPhotoId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SaleListingPhoto_saleListingId_fkey" FOREIGN KEY ("saleListingId") REFERENCES "SaleListing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SaleListingPhoto_propertyPhotoId_fkey" FOREIGN KEY ("propertyPhotoId") REFERENCES "PropertyPhoto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SaleListing_propertyId_key" ON "SaleListing"("propertyId");

-- CreateIndex
CREATE INDEX "SaleListing_status_idx" ON "SaleListing"("status");

-- CreateIndex
CREATE INDEX "SaleListingPhoto_saleListingId_order_idx" ON "SaleListingPhoto"("saleListingId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "SaleListingPhoto_saleListingId_propertyPhotoId_key" ON "SaleListingPhoto"("saleListingId", "propertyPhotoId");
