/**
 * Course Demo property photos (Stage 16.1).
 *
 * Files live under `<PHOTO_STORAGE_ROOT|storage>/demo/properties/{slug}/`.
 * Delete that folder to wipe demo photo bytes safely — it never mixes with
 * real CRM uploads under `properties/{propertyId}/`.
 *
 * Source images: Unsplash (royalty-free). Seed downloads them once and keeps
 * local copies so the CRM does not depend on Unsplash at runtime.
 */
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { getPhotoStorage } from "@/lib/photo-storage";
import { processPropertyPhotoUpload } from "@/lib/property-photo-process";
import { prisma } from "@/lib/prisma";

const DEMO_PHOTO_CATALOG: Record<
  string,
  Array<{ id: string; file: string; unsplashId: string; caption: string }>
> = {
  "demo-morskoy-vid": [
    {
      id: "demo-photo-morskoy-1",
      file: "01-cover.jpg",
      unsplashId: "1564013799919-ab600027ffc6",
      caption: "Апартаменты у моря (демо)",
    },
    {
      id: "demo-photo-morskoy-2",
      file: "02-bedroom.jpg",
      unsplashId: "1582719508461-905c673771fd",
      caption: "Спальня в морском стиле (демо)",
    },
    {
      id: "demo-photo-morskoy-3",
      file: "03-terrace.jpg",
      unsplashId: "1512917774080-9991f1c4c750",
      caption: "Терраса с видом (демо)",
    },
  ],
  "demo-studiya-park": [
    {
      id: "demo-photo-studiya-1",
      file: "01-cover.jpg",
      unsplashId: "1522708323590-d24dbb6b0267",
      caption: "Студия у парка (демо)",
    },
    {
      id: "demo-photo-studiya-2",
      file: "02-work.jpg",
      unsplashId: "1493809842364-78817add7ffb",
      caption: "Рабочая зона (демо)",
    },
    {
      id: "demo-photo-studiya-3",
      file: "03-bath.jpg",
      unsplashId: "1552321554-5fefe8c9ef14",
      caption: "Ванная (демо)",
    },
  ],
  "demo-semeynye": [
    {
      id: "demo-photo-semeynye-1",
      file: "01-cover.jpg",
      unsplashId: "1560448204-e02f11c3d0e2",
      caption: "Семейная гостиная (демо)",
    },
    {
      id: "demo-photo-semeynye-2",
      file: "02-dining.jpg",
      unsplashId: "1600210492486-724fe5c67fb0",
      caption: "Столовая (демо)",
    },
    {
      id: "demo-photo-semeynye-3",
      file: "03-kids.jpg",
      unsplashId: "1586023492125-27b2c045efd7",
      caption: "Детская зона (демо)",
    },
  ],
  "demo-panoramnyy-lyuks": [
    {
      id: "demo-photo-panorama-1",
      file: "01-cover.jpg",
      unsplashId: "1600596542815-ffad4c1539a9",
      caption: "Панорамный люкс (демо)",
    },
    {
      id: "demo-photo-panorama-2",
      file: "02-living.jpg",
      unsplashId: "1600607687939-ce8a6c25118c",
      caption: "Гостиная (демо)",
    },
    {
      id: "demo-photo-panorama-3",
      file: "03-view.jpg",
      unsplashId: "1600566753190-17f0baa2a6c3",
      caption: "Вид из окна (демо)",
    },
  ],
  "demo-terrasa": [
    {
      id: "demo-photo-terrasa-1",
      file: "01-cover.jpg",
      unsplashId: "1600585154340-be6161a56a0c",
      caption: "Терраса (демо)",
    },
    {
      id: "demo-photo-terrasa-2",
      file: "02-interior.jpg",
      unsplashId: "1600573472592-401b489a3cdc",
      caption: "Интерьер (демо)",
    },
    {
      id: "demo-photo-terrasa-3",
      file: "03-outdoor.jpg",
      unsplashId: "1512917774080-9991f1c4c750",
      caption: "Зона отдыха (демо)",
    },
  ],
  "demo-zagorodnyy-dom": [
    {
      id: "demo-photo-house-1",
      file: "01-cover.jpg",
      unsplashId: "1600585154526-990dced4db0d",
      caption: "Загородный дом (демо)",
    },
    {
      id: "demo-photo-house-2",
      file: "02-living.jpg",
      unsplashId: "1560185007-cde436f6a4d0",
      caption: "Гостиная дома (демо)",
    },
    {
      id: "demo-photo-house-3",
      file: "03-yard.jpg",
      unsplashId: "1605276374104-dee2a0ed3cd6",
      caption: "Участок (демо)",
    },
  ],
  "demo-loft-centr": [
    {
      id: "demo-photo-loft-1",
      file: "01-cover.jpg",
      unsplashId: "1505691938895-1758d7feb511",
      caption: "Лофт в центре (демо)",
    },
    {
      id: "demo-photo-loft-2",
      file: "02-brick.jpg",
      unsplashId: "1536376072261-38c75010e6c9",
      caption: "Кирпичная стена (демо)",
    },
    {
      id: "demo-photo-loft-3",
      file: "03-space.jpg",
      unsplashId: "1618221195710-dd6b41faaea6",
      caption: "Открытое пространство (демо)",
    },
  ],
};

function storageRoot() {
  return process.env.PHOTO_STORAGE_ROOT?.trim()
    ? path.resolve(process.env.PHOTO_STORAGE_ROOT.trim())
    : path.join(process.cwd(), "storage");
}

/** Absolute path to the disposable demo photo tree. */
export function getDemoPhotosDir() {
  return path.join(storageRoot(), "demo");
}

function unsplashUrl(photoId: string) {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=1600&q=80`;
}

async function downloadProcessed(unsplashId: string) {
  const response = await fetch(unsplashUrl(unsplashId), {
    headers: { "User-Agent": "rental-os-demo-seed/1.0" },
  });
  if (!response.ok) {
    throw new Error(`Не удалось скачать демо-фото ${unsplashId}: HTTP ${response.status}`);
  }
  const raw = Buffer.from(await response.arrayBuffer());
  return processPropertyPhotoUpload(raw, response.headers.get("content-type"));
}

/**
 * Download (once) and attach 3 photos per demo property.
 * Idempotent via stable PropertyPhoto ids (`demo-photo-*`).
 * Pass `forceRedownload: true` to replace local files (e.g. after catalog change).
 */
export async function seedDemoPropertyPhotos(
  properties: Array<{ id: string; slug: string }>,
  options?: { forceRedownload?: boolean },
): Promise<void> {
  const storage = getPhotoStorage();
  const force = options?.forceRedownload === true;

  for (const property of properties) {
    const shots = DEMO_PHOTO_CATALOG[property.slug];
    if (!shots) continue;

    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i]!;
      const storageKey = `demo/properties/${property.slug}/${shot.file}`;
      const absolutePath = storage.resolveAbsolutePath(storageKey);

      let processed;
      if (!force) {
        try {
          const { readFile, access } = await import("fs/promises");
          await access(absolutePath);
          const existing = await readFile(absolutePath);
          processed = await processPropertyPhotoUpload(existing, "image/jpeg");
        } catch {
          processed = undefined;
        }
      }

      if (!processed) {
        processed = await downloadProcessed(shot.unsplashId);
        await mkdir(path.dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, processed.bytes);
      }

      const url = `/api/properties/${property.id}/photos/${shot.id}/file`;
      await prisma.propertyPhoto.upsert({
        where: { id: shot.id },
        update: {
          propertyId: property.id,
          url,
          storageKey,
          originalFileName: shot.file,
          mimeType: processed.mimeType,
          sizeBytes: processed.sizeBytes,
          width: processed.width,
          height: processed.height,
          caption: shot.caption,
          sortOrder: i,
          isCover: i === 0,
        },
        create: {
          id: shot.id,
          propertyId: property.id,
          url,
          storageKey,
          originalFileName: shot.file,
          mimeType: processed.mimeType,
          sizeBytes: processed.sizeBytes,
          width: processed.width,
          height: processed.height,
          caption: shot.caption,
          sortOrder: i,
          isCover: i === 0,
        },
      });
    }
  }
}

/** Link seeded PropertyPhotos into long-term / sale listing galleries. */
export async function linkDemoListingPhotos(): Promise<void> {
  const ltTargets = [
    { propertySlug: "demo-semeynye", photoPrefix: "demo-photo-semeynye-" },
    { propertySlug: "demo-zagorodnyy-dom", photoPrefix: "demo-photo-house-" },
  ];
  for (const target of ltTargets) {
    const listing = await prisma.longTermListing.findFirst({
      where: { property: { slug: target.propertySlug } },
      select: { id: true },
    });
    if (!listing) continue;
    const photos = await prisma.propertyPhoto.findMany({
      where: { id: { startsWith: target.photoPrefix } },
      orderBy: { sortOrder: "asc" },
    });
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i]!;
      await prisma.longTermListingPhoto.upsert({
        where: {
          listingId_photoId: { listingId: listing.id, photoId: photo.id },
        },
        update: { sortOrder: i, included: true },
        create: {
          listingId: listing.id,
          photoId: photo.id,
          sortOrder: i,
          included: true,
        },
      });
    }
  }

  const saleTargets = [
    { propertySlug: "demo-studiya-park", photoPrefix: "demo-photo-studiya-" },
    { propertySlug: "demo-loft-centr", photoPrefix: "demo-photo-loft-" },
  ];
  for (const target of saleTargets) {
    const listing = await prisma.saleListing.findFirst({
      where: { property: { slug: target.propertySlug } },
      select: { id: true },
    });
    if (!listing) continue;
    const photos = await prisma.propertyPhoto.findMany({
      where: { id: { startsWith: target.photoPrefix } },
      orderBy: { sortOrder: "asc" },
    });
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i]!;
      await prisma.saleListingPhoto.upsert({
        where: {
          saleListingId_propertyPhotoId: {
            saleListingId: listing.id,
            propertyPhotoId: photo.id,
          },
        },
        update: { order: i },
        create: {
          saleListingId: listing.id,
          propertyPhotoId: photo.id,
          order: i,
        },
      });
    }
  }
}

/** Remove the disposable demo photo directory (files only; DB rows deleted separately). */
export async function wipeDemoPhotoFiles(): Promise<void> {
  await rm(getDemoPhotosDir(), { recursive: true, force: true });
}
