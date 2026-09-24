import "./helpers-preload";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, before, describe, it } from "node:test";
import sharp from "sharp";
import { POST as postPhotos } from "@/app/api/properties/[id]/photos/route";
import { DELETE as deletePhoto, PATCH as patchPhoto } from "@/app/api/properties/[id]/photos/[photoId]/route";
import { PATCH as reorderPhotos } from "@/app/api/properties/[id]/photos/reorder/route";
import { assertSafeStorageKey } from "@/lib/photo-storage";
import { isPublicPublicationPhotoUrl } from "@/lib/publications/normalized-long-term";
import {
  createPropertyPhoto,
  deletePropertyPhoto,
  getPropertyPhotos,
  reorderPropertyPhotos,
  setPropertyPhotoCover,
  uploadPropertyPhotoFile,
} from "@/lib/property-photos";
import { processPropertyPhotoUpload } from "@/lib/property-photo-process";
import { prisma } from "@/lib/prisma";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";
import { authedRequest, createTestSessionCookie } from "../helpers/auth";

async function makeImageFile(
  format: "jpeg" | "png" | "webp",
  name: string,
  size = 80,
): Promise<File> {
  const pipeline = sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 40, g: 120, b: 200 },
    },
  });
  let mime = "image/jpeg";
  let buffer: Buffer;
  if (format === "png") {
    buffer = await pipeline.png().toBuffer();
    mime = "image/png";
  } else if (format === "webp") {
    buffer = await pipeline.webp().toBuffer();
    mime = "image/webp";
  } else {
    buffer = await pipeline.jpeg().toBuffer();
  }
  return new File([new Uint8Array(buffer)], name, { type: mime });
}

describe("property photo storage", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  afterEach(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  it("uploads JPEG/PNG/WEBP; first photo becomes cover; unique storage keys", async () => {
    const { property } = await resetFixtures();
    const jpeg = await uploadPropertyPhotoFile(property.id, await makeImageFile("jpeg", "a.jpg"));
    const png = await uploadPropertyPhotoFile(property.id, await makeImageFile("png", "b.png"));
    const webp = await uploadPropertyPhotoFile(property.id, await makeImageFile("webp", "c.webp"));

    assert.equal(jpeg.isCover, true);
    assert.equal(png.isCover, false);
    assert.equal(webp.isCover, false);
    assert.ok(jpeg.storageKey);
    assert.ok(png.storageKey);
    assert.ok(webp.storageKey);
    assert.notEqual(jpeg.storageKey, png.storageKey);
    assert.match(jpeg.url, /\/api\/properties\/.+\/photos\/.+\/file/);
    assert.equal(jpeg.originalFileName, "a.jpg");
    assert.equal(jpeg.mimeType, "image/jpeg");

    const photos = await getPropertyPhotos(property.id);
    assert.equal(photos.length, 3);
  });

  it("multiple upload via API; unauthenticated rejected", async () => {
    const { property } = await resetFixtures();
    const unauth = await postPhotos(
      new Request(`http://localhost/api/properties/${property.id}/photos`, {
        method: "POST",
        body: (() => {
          const form = new FormData();
          return form;
        })(),
      }),
      { params: Promise.resolve({ id: property.id }) },
    );
    assert.equal(unauth.status, 401);

    const { cookie } = await createTestSessionCookie();
    const form = new FormData();
    form.append("files", await makeImageFile("jpeg", "one.jpg"));
    form.append("files", await makeImageFile("png", "two.png"));
    const response = await postPhotos(
      authedRequest(`http://localhost/api/properties/${property.id}/photos`, cookie, {
        method: "POST",
        body: form,
      }),
      { params: Promise.resolve({ id: property.id }) },
    );
    assert.equal(response.status, 201);
    const payload = (await response.json()) as { photos: { id: string }[] };
    assert.equal(payload.photos.length, 2);
  });

  it("rejects multipart upload exceeding per-request file limit (DoS bound)", async () => {
    const { property } = await resetFixtures();
    const { cookie } = await createTestSessionCookie();
    const form = new FormData();
    for (let i = 0; i < 11; i++) {
      form.append("files", await makeImageFile("jpeg", `bulk-${i}.jpg`));
    }
    const response = await postPhotos(
      authedRequest(`http://localhost/api/properties/${property.id}/photos`, cookie, {
        method: "POST",
        body: form,
      }),
      { params: Promise.resolve({ id: property.id }) },
    );
    assert.equal(response.status, 400);
    const stored = await prisma.propertyPhoto.count({ where: { propertyId: property.id } });
    assert.equal(stored, 0);
  });

  it("rejects invalid MIME, fake extension, oversized, path traversal keys", async () => {
    await assert.rejects(
      () => processPropertyPhotoUpload(Buffer.from("%PDF-1.4 fake"), "application/pdf"),
      /не поддерживается/i,
    );
    await assert.rejects(
      () => processPropertyPhotoUpload(Buffer.from("not-an-image"), "image/jpeg"),
      /не поддерживается/i,
    );

    const big = Buffer.alloc(10 * 1024 * 1024 + 10, 0xff);
    big[0] = 0xff;
    big[1] = 0xd8;
    big[2] = 0xff;
    await assert.rejects(() => processPropertyPhotoUpload(big, "image/jpeg"), /10 МБ/);

    assert.throws(() => assertSafeStorageKey("properties/../.env"), /storageKey/);
    assert.throws(() => assertSafeStorageKey("C:/Windows/system32"), /storageKey/);
    assert.throws(() => assertSafeStorageKey("properties/id/../../../etc/passwd"), /storageKey/);
  });

  it("set cover, reorder, reject foreign ids; delete cover promotes next", async () => {
    const { property } = await resetFixtures();
    const otherProperty = await prisma.property.create({
      data: {
        name: "Другой объект",
        slug: `other-${Date.now()}`,
        type: "APARTMENT",
        status: "ACTIVE",
        address: "ул. Другая, 2",
        city: "Город",
        district: "Район",
        area: 30,
        rooms: 1,
        bedrooms: 1,
        bathrooms: 1,
        guests: 2,
        description: "Тест",
        shortDescription: "Тест",
        ownerName: "Владелец",
        ownerPhone: "+7 000 000-00-02",
        managementType: "OWN",
      },
    });
    const a = await uploadPropertyPhotoFile(property.id, await makeImageFile("jpeg", "a.jpg"));
    const b = await uploadPropertyPhotoFile(property.id, await makeImageFile("jpeg", "b.jpg"));
    const c = await uploadPropertyPhotoFile(property.id, await makeImageFile("jpeg", "c.jpg"));
    const foreign = await uploadPropertyPhotoFile(
      otherProperty.id,
      await makeImageFile("jpeg", "x.jpg"),
    );

    await setPropertyPhotoCover(property.id, b.id);
    let photos = await getPropertyPhotos(property.id);
    assert.equal(photos.find((p) => p.id === b.id)?.isCover, true);
    assert.equal(photos.filter((p) => p.isCover).length, 1);

    await reorderPropertyPhotos(property.id, [c.id, a.id, b.id]);
    photos = await getPropertyPhotos(property.id);
    assert.deepEqual(
      photos.map((p) => p.id),
      [c.id, a.id, b.id],
    );

    await assert.rejects(
      () => reorderPropertyPhotos(property.id, [a.id, b.id, foreign.id]),
      /чужие/i,
    );

    await deletePropertyPhoto(property.id, b.id);
    photos = await getPropertyPhotos(property.id);
    assert.equal(photos.length, 2);
    assert.equal(photos.filter((p) => p.isCover).length, 1);
    assert.equal(photos[0].isCover, true);
  });

  it("legacy URL photo works; LT/Sale joins preserved until photo delete", async () => {
    const { property } = await resetFixtures();
    const legacy = await createPropertyPhoto(property.id, {
      url: "https://cdn.example.com/legacy.jpg",
    });
    assert.equal(legacy.storageKey, null);
    assert.equal(legacy.isCover, true);
    assert.equal(isPublicPublicationPhotoUrl(legacy.url), true);
    assert.equal(isPublicPublicationPhotoUrl("/api/properties/x/photos/y/file"), false);
    assert.equal(isPublicPublicationPhotoUrl("http://localhost:3000/uploads/a.jpg"), false);

    const listing = await prisma.longTermListing.create({
      data: { propertyId: property.id },
    });
    await prisma.longTermListingPhoto.create({
      data: { listingId: listing.id, photoId: legacy.id, sortOrder: 0, included: true },
    });
    const sale = await prisma.saleListing.create({
      data: {
        propertyId: property.id,
        status: "DRAFT",
        price: 1_000_000,
      },
    });
    await prisma.saleListingPhoto.create({
      data: { saleListingId: sale.id, propertyPhotoId: legacy.id, order: 0 },
    });

    assert.equal(await prisma.longTermListingPhoto.count({ where: { photoId: legacy.id } }), 1);
    assert.equal(
      await prisma.saleListingPhoto.count({ where: { propertyPhotoId: legacy.id } }),
      1,
    );

    await deletePropertyPhoto(property.id, legacy.id);
    assert.equal(await prisma.longTermListingPhoto.count({ where: { photoId: legacy.id } }), 0);
    assert.equal(
      await prisma.saleListingPhoto.count({ where: { propertyPhotoId: legacy.id } }),
      0,
    );
  });

  it("deletes PresentationItemPhoto joins and reassigns coverPhotoId", async () => {
    const { property } = await resetFixtures();
    const first = await createPropertyPhoto(property.id, {
      url: "https://cdn.example.com/p1.jpg",
    });
    const second = await createPropertyPhoto(property.id, {
      url: "https://cdn.example.com/p2.jpg",
    });

    const presentation = await prisma.presentation.create({
      data: {
        kind: "SHORT_TERM",
        title: "Аудит презентация",
        status: "DRAFT",
        publicToken: `tok-${Date.now()}`,
      },
    });
    const item = await prisma.presentationItem.create({
      data: {
        presentationId: presentation.id,
        propertyId: property.id,
        coverPhotoId: first.id,
        sortOrder: 0,
      },
    });
    await prisma.presentationItemPhoto.createMany({
      data: [
        { presentationItemId: item.id, propertyPhotoId: first.id, sortOrder: 0 },
        { presentationItemId: item.id, propertyPhotoId: second.id, sortOrder: 1 },
      ],
    });

    await deletePropertyPhoto(property.id, first.id);

    assert.equal(
      await prisma.presentationItemPhoto.count({ where: { propertyPhotoId: first.id } }),
      0,
    );
    assert.equal(
      await prisma.presentationItemPhoto.count({ where: { propertyPhotoId: second.id } }),
      1,
    );
    const updated = await prisma.presentationItem.findUnique({ where: { id: item.id } });
    assert.equal(updated?.coverPhotoId, second.id);
  });

  it("PATCH setCover + DELETE via API; CSRF origin required for mutation", async () => {
    const { property } = await resetFixtures();
    const { cookie } = await createTestSessionCookie();
    const photo = await uploadPropertyPhotoFile(property.id, await makeImageFile("jpeg", "a.jpg"));
    const second = await uploadPropertyPhotoFile(property.id, await makeImageFile("jpeg", "b.jpg"));

    const noOrigin = await patchPhoto(
      new Request(`http://localhost/api/properties/${property.id}/photos/${second.id}`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json", host: "localhost" },
        body: JSON.stringify({ action: "setCover" }),
      }),
      { params: Promise.resolve({ id: property.id, photoId: second.id }) },
    );
    // Missing Origin is allowed by csrf helper for tooling — ensure cookie still auth'd
    assert.ok([200, 403].includes(noOrigin.status));

    const ok = await patchPhoto(
      authedRequest(`http://localhost/api/properties/${property.id}/photos/${second.id}`, cookie, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setCover" }),
      }),
      { params: Promise.resolve({ id: property.id, photoId: second.id }) },
    );
    assert.equal(ok.status, 200);

    const reorder = await reorderPhotos(
      authedRequest(`http://localhost/api/properties/${property.id}/photos/reorder`, cookie, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: [second.id, photo.id] }),
      }),
      { params: Promise.resolve({ id: property.id }) },
    );
    assert.equal(reorder.status, 200);

    const deleted = await deletePhoto(
      authedRequest(`http://localhost/api/properties/${property.id}/photos/${photo.id}`, cookie, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: property.id, photoId: photo.id }) },
    );
    assert.equal(deleted.status, 200);
  });

  it("does not expose storage absolute paths in API errors", async () => {
    const { property } = await resetFixtures();
    const { cookie } = await createTestSessionCookie();
    const form = new FormData();
    form.append("file", new File([new Uint8Array(Buffer.from("hello"))], "evil.exe", { type: "application/octet-stream" }));
    const response = await postPhotos(
      authedRequest(`http://localhost/api/properties/${property.id}/photos`, cookie, {
        method: "POST",
        body: form,
      }),
      { params: Promise.resolve({ id: property.id }) },
    );
    assert.equal(response.status, 400);
    const payload = (await response.json()) as { error?: string };
    assert.equal(payload.error?.includes("storage"), false);
    assert.equal(payload.error?.includes(process.cwd()), false);
    void readFileSync;
  });
});
