-- Stage 16.0 Property day prices (nightly rate overrides for the occupancy calendar)
CREATE TABLE "PropertyDayPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "price" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PropertyDayPrice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PropertyDayPrice_propertyId_date_key" ON "PropertyDayPrice"("propertyId", "date");
CREATE INDEX "PropertyDayPrice_propertyId_date_idx" ON "PropertyDayPrice"("propertyId", "date");
