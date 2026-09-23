-- AlterTable (SQLite: no non-constant defaults on ADD COLUMN)
ALTER TABLE "PropertyPhoto" ADD COLUMN "storageKey" TEXT;
ALTER TABLE "PropertyPhoto" ADD COLUMN "originalFileName" TEXT;
ALTER TABLE "PropertyPhoto" ADD COLUMN "mimeType" TEXT;
ALTER TABLE "PropertyPhoto" ADD COLUMN "sizeBytes" INTEGER;
ALTER TABLE "PropertyPhoto" ADD COLUMN "width" INTEGER;
ALTER TABLE "PropertyPhoto" ADD COLUMN "height" INTEGER;
ALTER TABLE "PropertyPhoto" ADD COLUMN "isCover" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "PropertyPhoto" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00';

UPDATE "PropertyPhoto" SET "updatedAt" = CURRENT_TIMESTAMP;

-- Backfill: first photo per property (by sortOrder, then createdAt) becomes cover
UPDATE "PropertyPhoto"
SET "isCover" = 1
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "propertyId"
        ORDER BY "sortOrder" ASC, "createdAt" ASC
      ) AS "rn"
    FROM "PropertyPhoto"
  )
  WHERE "rn" = 1
);

-- CreateIndex
CREATE INDEX "PropertyPhoto_propertyId_isCover_idx" ON "PropertyPhoto"("propertyId", "isCover");
