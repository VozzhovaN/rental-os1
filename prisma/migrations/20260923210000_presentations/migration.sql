-- Stage 12.6.4 Presentations
CREATE TABLE "Presentation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicToken" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "companyName" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "internalNote" TEXT,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "Presentation_publicToken_key" ON "Presentation"("publicToken");
CREATE INDEX "Presentation_status_idx" ON "Presentation"("status");
CREATE INDEX "Presentation_kind_idx" ON "Presentation"("kind");
CREATE INDEX "Presentation_createdAt_idx" ON "Presentation"("createdAt");

CREATE TABLE "PresentationItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "presentationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "titleOverride" TEXT,
    "priceOverride" INTEGER,
    "descriptionOverride" TEXT,
    "coverPhotoId" TEXT,
    "videoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PresentationItem_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "Presentation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PresentationItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PresentationItem_coverPhotoId_fkey" FOREIGN KEY ("coverPhotoId") REFERENCES "PropertyPhoto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "PresentationItem_presentationId_sortOrder_idx" ON "PresentationItem"("presentationId", "sortOrder");
CREATE INDEX "PresentationItem_propertyId_idx" ON "PresentationItem"("propertyId");

CREATE TABLE "PresentationItemPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "presentationItemId" TEXT NOT NULL,
    "propertyPhotoId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PresentationItemPhoto_presentationItemId_fkey" FOREIGN KEY ("presentationItemId") REFERENCES "PresentationItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PresentationItemPhoto_propertyPhotoId_fkey" FOREIGN KEY ("propertyPhotoId") REFERENCES "PropertyPhoto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PresentationItemPhoto_presentationItemId_propertyPhotoId_key" ON "PresentationItemPhoto"("presentationItemId", "propertyPhotoId");
CREATE INDEX "PresentationItemPhoto_presentationItemId_sortOrder_idx" ON "PresentationItemPhoto"("presentationItemId", "sortOrder");

CREATE TABLE "PresentationSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "presentationItemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "PresentationSection_presentationItemId_fkey" FOREIGN KEY ("presentationItemId") REFERENCES "PresentationItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PresentationSection_presentationItemId_sortOrder_idx" ON "PresentationSection"("presentationItemId", "sortOrder");
