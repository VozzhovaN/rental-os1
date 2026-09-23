import "./helpers-preload";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { PATCH as patchLongTermListing } from "@/app/api/long-term-listings/[id]/route";
import { createLongTermListing, getLongTermListingById, replaceLongTermPhotos, updateLongTermListing } from "@/lib/long-term-listings";
import { prisma } from "@/lib/prisma";
import { createPropertyPhoto } from "@/lib/property-photos";
import { applyPublicationEvent, createPublication } from "@/lib/publications";
import {
  buildNormalizedLongTermPublicationData,
  hashNormalizedLongTermPublicationData,
  isPublicPublicationPhotoUrl,
} from "@/lib/publications/normalized-long-term";
import { validateLongTermPublicationReadiness } from "@/lib/publications/readiness";
import {
  longTermListingUpdateFromFormData,
  parseUpdateLongTermListing,
} from "@/lib/validations/long-term-listing";
import { authedRequest, createTestSessionCookie } from "../helpers/auth";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";

describe("publication data readiness", () => {
  let authCookie: string;

  before(async () => {
    await prepareTestDatabase();
    const session = await createTestSessionCookie();
    authCookie = session.cookie;
  });

  async function createReadyListing() {
    const { channel, property } = await resetFixtures();
    await prisma.property.update({
      where: { id: property.id },
      data: { floor: 4 },
    });
    const created = await createLongTermListing({ propertyId: property.id });
    const listing = await updateLongTermListing(created.listing.id, {
      status: "ACTIVE",
      monthlyPrice: 70000,
      deposit: 70000,
      commission: 0,
      minimumRentalPeriod: 6,
      marketingTitle: "Светлая квартира",
      description: "Описание для публикации",
      rentalTerms: "От 6 месяцев",
      publicationContactName: "Анна",
      publicationPhoneCountryCode: "7",
      publicationPhoneNumber: "9001234567",
    });
    const first = await createPropertyPhoto(property.id, { url: "https://cdn.example.com/a.jpg" });
    const second = await createPropertyPhoto(property.id, { url: "https://cdn.example.com/b.jpg" });
    const withPhotos = await replaceLongTermPhotos(listing.id, {
      items: [
        { photoId: second.id, sortOrder: 0, included: true },
        { photoId: first.id, sortOrder: 1, included: true },
      ],
    });

    return { channel, property, listing: withPhotos!, first, second };
  }

  it("собирает NormalizedLongTermPublicationData из Property, карточки, фото и контакта", async () => {
    const { listing, second } = await createReadyListing();
    const normalized = buildNormalizedLongTermPublicationData(listing);

    assert.equal(normalized.listingId, listing.id);
    assert.equal(normalized.title, "Светлая квартира");
    assert.equal(normalized.description.includes("Описание для публикации"), true);
    assert.equal(normalized.description.includes("От 6 месяцев"), true);
    assert.equal(normalized.monthlyPrice, 70000);
    assert.equal(normalized.deposit, 70000);
    assert.equal(normalized.commissionMapping, "MAPPING_BLOCKED");
    assert.equal(normalized.minimumRentalPeriodMonths, 6);
    assert.equal(normalized.property.address, listing.property.address);
    assert.equal(normalized.property.floor, 4);
    assert.equal(normalized.property.rooms, 1);
    assert.equal(normalized.property.area, 42);
    assert.equal(normalized.contact.name, "Анна");
    assert.equal(normalized.contact.phoneCountryCode, "7");
    assert.equal(normalized.contact.phoneNumber, "9001234567");
    assert.equal(normalized.photos.length, 2);
    assert.equal(normalized.photos[0].id, second.id);
    assert.equal(normalized.photos[0].isPrimary, true);
    assert.equal(normalized.photos[1].isPrimary, false);
  });

  it("ARCHIVED listing: ready = false и Publication не меняется", async () => {
    const { channel, listing } = await createReadyListing();
    const created = await createPublication({
      longTermListingId: listing.id,
      salesChannelId: channel.id,
    });
    await applyPublicationEvent(created.publication.id, "START_PUBLISH");
    const archived = await updateLongTermListing(listing.id, { status: "ARCHIVED" });
    const readiness = validateLongTermPublicationReadiness(archived);

    assert.equal(readiness.ready, false);
    assert.ok(readiness.errors.some((item) => item.code === "LISTING_ARCHIVED"));
    const publication = await prisma.publication.findUnique({ where: { id: created.publication.id } });
    assert.equal(publication?.status, "PUBLISHING");
    assert.equal(await prisma.publication.count({ where: { longTermListingId: listing.id } }), 1);
  });

  it("monthlyPrice <= 0: ready = false", async () => {
    const { listing } = await createReadyListing();
    const updated = await updateLongTermListing(listing.id, { monthlyPrice: 0 });
    const readiness = validateLongTermPublicationReadiness(updated);
    assert.equal(readiness.ready, false);
    assert.ok(readiness.errors.some((item) => item.code === "INVALID_MONTHLY_PRICE"));
  });

  it("missing contact: ready = false", async () => {
    const { listing } = await createReadyListing();
    const updated = await updateLongTermListing(listing.id, {
      publicationContactName: null,
      publicationPhoneCountryCode: null,
      publicationPhoneNumber: null,
    });
    const readiness = validateLongTermPublicationReadiness(updated);
    assert.equal(readiness.ready, false);
    assert.ok(readiness.errors.some((item) => item.code === "MISSING_PUBLICATION_CONTACT"));
  });

  it("invalid phone: ready = false, Zod отклоняет произвольный текст", async () => {
    const { listing } = await createReadyListing();
    assert.equal(
      parseUpdateLongTermListing({ publicationPhoneNumber: "позвонить вечером" }).success,
      false,
    );
    assert.equal(parseUpdateLongTermListing({ publicationPhoneCountryCode: "++" }).success, false);
    assert.equal(parseUpdateLongTermListing({ publicationPhoneNumber: "" }).success, true);

    await prisma.longTermListing.update({
      where: { id: listing.id },
      data: { publicationPhoneNumber: "not-a-phone" },
    });
    const reloaded = await getLongTermListingById(listing.id);
    const readiness = validateLongTermPublicationReadiness(reloaded!);
    assert.equal(readiness.ready, false);
    assert.ok(readiness.errors.some((item) => item.code === "INVALID_PUBLICATION_PHONE"));
  });

  it("localhost photo не publication-ready", async () => {
    const { property, listing } = await createReadyListing();
    const photo = await createPropertyPhoto(property.id, { url: "https://localhost/photo.jpg" });
    const updated = await replaceLongTermPhotos(listing.id, {
      items: [{ photoId: photo.id, sortOrder: 0, included: true }],
    });
    const readiness = validateLongTermPublicationReadiness(updated!);
    assert.equal(isPublicPublicationPhotoUrl("https://localhost/photo.jpg"), false);
    assert.equal(isPublicPublicationPhotoUrl("https://127.0.0.1/photo.jpg"), false);
    assert.equal(isPublicPublicationPhotoUrl("/uploads/photo.jpg"), false);
    assert.equal(readiness.ready, false);
    assert.ok(readiness.errors.some((item) => item.code === "PHOTO_URL_NOT_PUBLIC"));
  });

  it("HTTP photo URL не publication-ready", async () => {
    const { property, listing } = await createReadyListing();
    const photo = await createPropertyPhoto(property.id, { url: "http://cdn.example.com/a.jpg" });
    const updated = await replaceLongTermPhotos(listing.id, {
      items: [{ photoId: photo.id, sortOrder: 0, included: true }],
    });
    assert.equal(isPublicPublicationPhotoUrl("http://cdn.example.com/a.jpg"), false);
    const readiness = validateLongTermPublicationReadiness(updated!);
    assert.equal(readiness.ready, false);
    assert.ok(readiness.errors.some((item) => item.code === "PHOTO_URL_NOT_PUBLIC"));
  });

  it("valid HTTPS photo принимается структурно", async () => {
    const { listing } = await createReadyListing();
    assert.equal(isPublicPublicationPhotoUrl("https://cdn.example.com/a.jpg"), true);
    const readiness = validateLongTermPublicationReadiness(listing);
    assert.equal(readiness.ready, true);
    assert.equal(
      readiness.errors.some((item) => item.code === "PHOTO_URL_NOT_PUBLIC"),
      false,
    );
  });

  it("порядок фото детерминирован, первое выбранное — primary", async () => {
    const { listing, first, second } = await createReadyListing();
    const normalized = buildNormalizedLongTermPublicationData(listing);
    assert.deepEqual(
      normalized.photos.map((photo) => photo.id),
      [second.id, first.id],
    );
    assert.equal(normalized.photos[0].isPrimary, true);

    const swapped = await replaceLongTermPhotos(listing.id, {
      items: [
        { photoId: first.id, sortOrder: 0, included: true },
        { photoId: second.id, sortOrder: 1, included: true },
      ],
    });
    const swappedNormalized = buildNormalizedLongTermPublicationData(swapped!);
    assert.equal(swappedNormalized.photos[0].id, first.id);
    assert.equal(swappedNormalized.photos[0].isPrimary, true);
  });

  it("одинаковые normalized data дают одинаковый SHA-256", async () => {
    const { listing } = await createReadyListing();
    const first = buildNormalizedLongTermPublicationData(listing);
    const second = buildNormalizedLongTermPublicationData(listing);
    assert.equal(hashNormalizedLongTermPublicationData(first), hashNormalizedLongTermPublicationData(second));
  });

  it("изменение publication-relevant поля меняет hash", async () => {
    const { listing } = await createReadyListing();
    const original = hashNormalizedLongTermPublicationData(buildNormalizedLongTermPublicationData(listing));

    const withPrice = await updateLongTermListing(listing.id, { monthlyPrice: 71000 });
    const priceHash = hashNormalizedLongTermPublicationData(buildNormalizedLongTermPublicationData(withPrice));
    assert.notEqual(priceHash, original);

    const withDescription = await updateLongTermListing(listing.id, {
      monthlyPrice: 70000,
      description: "Другое описание",
    });
    const descriptionHash = hashNormalizedLongTermPublicationData(
      buildNormalizedLongTermPublicationData(withDescription),
    );
    assert.notEqual(descriptionHash, original);

    const withPhotos = await replaceLongTermPhotos(listing.id, {
      items: listing.photos.map((item, index) => ({
        photoId: item.photoId,
        sortOrder: listing.photos.length - 1 - index,
        included: true,
      })),
    });
    const orderHash = hashNormalizedLongTermPublicationData(buildNormalizedLongTermPublicationData(withPhotos!));
    assert.notEqual(orderHash, original);
  });

  it("посторонние метаданные БД не влияют на hash", async () => {
    const { property, listing, first } = await createReadyListing();
    const original = hashNormalizedLongTermPublicationData(buildNormalizedLongTermPublicationData(listing));

    await prisma.property.update({
      where: { id: property.id },
      data: { ownerName: "Другой владелец", ownerPhone: "+7 000 000-00-99" },
    });
    await prisma.propertyPhoto.update({
      where: { id: first.id },
      data: { caption: "служебная подпись" },
    });
    await prisma.longTermListing.update({
      where: { id: listing.id },
      data: { updatedAt: new Date("2026-01-01T00:00:00.000Z") },
    });

    const reloaded = await getLongTermListingById(listing.id);
    const next = hashNormalizedLongTermPublicationData(buildNormalizedLongTermPublicationData(reloaded!));
    assert.equal(next, original);
  });

  it("нет выбранных фото — warning, не error", async () => {
    const { listing } = await createReadyListing();
    const cleared = await replaceLongTermPhotos(listing.id, { items: [] });
    const readiness = validateLongTermPublicationReadiness(cleared!);
    assert.equal(readiness.ready, true);
    assert.ok(readiness.warnings.some((item) => item.code === "MISSING_PHOTOS"));
  });

  it("дом без этажа проходит baseline, квартира без этажа — нет", async () => {
    const { listing, property } = await createReadyListing();
    await prisma.property.update({
      where: { id: property.id },
      data: { floor: null },
    });
    const apartment = await getLongTermListingById(listing.id);
    const apartmentReadiness = validateLongTermPublicationReadiness(apartment!);
    assert.equal(apartmentReadiness.ready, false);
    assert.ok(apartmentReadiness.errors.some((item) => item.code === "MISSING_FLOOR"));

    const house = await prisma.property.create({
      data: {
        name: "Дом без этажа",
        slug: `house-floor-${Date.now()}`,
        type: "HOUSE",
        status: "ACTIVE",
        address: "ул. Дом, д. 8",
        city: "Тестовый город",
        district: "Район Д",
        area: 120,
        rooms: 4,
        bedrooms: 3,
        bathrooms: 2,
        floor: null,
        guests: 8,
        description: "Дом",
        shortDescription: "Дом",
        ownerName: "Владелец",
        ownerPhone: "+7 000 000-00-08",
        managementType: "OWN",
      },
    });
    const created = await createLongTermListing({ propertyId: house.id });
    const houseListing = await updateLongTermListing(created.listing.id, {
      monthlyPrice: 150000,
      description: "Дом в аренду",
      marketingTitle: "Дом",
      publicationContactName: "Анна",
      publicationPhoneCountryCode: "7",
      publicationPhoneNumber: "9001234567",
    });
    const houseReadiness = validateLongTermPublicationReadiness(houseListing);
    assert.equal(
      houseReadiness.errors.some((item) => item.code === "MISSING_FLOOR"),
      false,
    );
  });

  it("PATCH не принимает поля Publication и нормализует контакт", async () => {
    const { listing } = await createReadyListing();
    const forbidden = await patchLongTermListing(
      authedRequest(`http://localhost/api/long-term-listings/${listing.id}`, authCookie, {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          monthlyPrice: 72000,
          externalId: "hack",
          lastError: "x",
        }),
      }),
      { params: Promise.resolve({ id: listing.id }) },
    );
    assert.equal(forbidden.status, 400);

    const ok = await patchLongTermListing(
      authedRequest(`http://localhost/api/long-term-listings/${listing.id}`, authCookie, {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          publicationContactName: "  Мария  ",
          publicationPhoneCountryCode: "+7",
          publicationPhoneNumber: "900 555 44 33",
        }),
      }),
      { params: Promise.resolve({ id: listing.id }) },
    );
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as {
      listing: {
        publicationContactName: string;
        publicationPhoneCountryCode: string;
        publicationPhoneNumber: string;
      };
    };
    assert.equal(body.listing.publicationContactName, "Мария");
    assert.equal(body.listing.publicationPhoneCountryCode, "7");
    assert.equal(body.listing.publicationPhoneNumber, "9005554433");
  });

  it("form DTO передаёт контакт публикации и не содержит propertyId", () => {
    const form = new FormData();
    form.set("status", "ACTIVE");
    form.set("monthlyPrice", "65000");
    form.set("specialOfferPrice", "");
    form.set("specialOfferText", "");
    form.set("deposit", "0");
    form.set("commission", "0");
    form.set("minimumRentalPeriod", "1");
    form.set("marketingTitle", "Заголовок");
    form.set("description", "Описание");
    form.set("rentalTerms", "");
    form.set("infrastructureDescription", "");
    form.set("securityDescription", "");
    form.set("parkingDescription", "");
    form.set("transportDescription", "");
    form.set("advantagesDescription", "");
    form.set("publicationContactName", "Анна");
    form.set("publicationPhoneCountryCode", "7");
    form.set("publicationPhoneNumber", "9001234567");

    const payload = longTermListingUpdateFromFormData(form);
    assert.equal("propertyId" in payload, false);
    assert.equal(payload.publicationContactName, "Анна");
    assert.equal(payload.publicationPhoneCountryCode, "7");
    assert.equal(payload.publicationPhoneNumber, "9001234567");
  });
});
