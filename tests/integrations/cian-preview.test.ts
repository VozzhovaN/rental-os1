import "./helpers-preload";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { GET as getCianPreview } from "@/app/api/long-term-listings/[id]/publications/cian/preview/route";
import { GET as getCianFeedPreview } from "@/app/api/crm/cian-feed-preview/route";
import {
  createLongTermListing,
  replaceLongTermPhotos,
  updateLongTermListing,
} from "@/lib/long-term-listings";
import { createPropertyPhoto } from "@/lib/property-photos";
import { prisma } from "@/lib/prisma";
import {
  buildCianListingPreview,
  hashCianFlatRentPayload,
  prepareCianFeed,
} from "@/lib/publications/providers/cian";
import { hashNormalizedLongTermPublicationData } from "@/lib/publications/normalized-long-term";
import { makeNormalizedCianFixture } from "../helpers/cian-fixtures";
import { authedRequest, createTestSessionCookie } from "../helpers/auth";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";

describe("cian preview and feed readiness", () => {
  let authCookie: string;

  before(async () => {
    await prepareTestDatabase();
    const session = await createTestSessionCookie();
    authCookie = session.cookie;
  });

  async function createValidListing() {
    const { property } = await resetFixtures();
    await prisma.property.update({
      where: { id: property.id },
      data: { floor: 4, totalFloors: 9 },
    });
    const created = await createLongTermListing({ propertyId: property.id });
    const listing = await updateLongTermListing(created.listing.id, {
      status: "ACTIVE",
      monthlyPrice: 70000,
      deposit: 70000,
      commission: 0,
      minimumRentalPeriod: 6,
      marketingTitle: "Светлая квартира",
      description: "Светлая квартира у парка. Отдельная кухня, мебель, техника.",
      rentalTerms: "От 6 месяцев",
      publicationContactName: "Анна",
      publicationPhoneCountryCode: "7",
      publicationPhoneNumber: "9001234567",
    });
    const photo = await createPropertyPhoto(property.id, {
      url: "https://cdn.example.com/a.jpg",
    });
    const withPhotos = await replaceLongTermPhotos(listing.id, {
      items: [{ photoId: photo.id, sortOrder: 0, included: true }],
    });
    return withPhotos!;
  }

  it("valid listing → CIAN preview XML", async () => {
    const listing = await createValidListing();
    const preview = buildCianListingPreview(listing);
    assert.equal(preview.ready, true);
    assert.ok(preview.xml?.includes("<Category>flatRent</Category>"));
    assert.ok(preview.xml?.includes(`<ExternalId>${listing.id}</ExternalId>`));
    assert.equal(preview.fileName, `cian-${listing.id}.xml`);
  });

  it("invalid listing → structured errors, XML отсутствует", async () => {
    const listing = await createValidListing();
    const broken = await updateLongTermListing(listing.id, {
      publicationPhoneNumber: null,
      description: "коротко",
    });
    const preview = buildCianListingPreview(broken);
    assert.equal(preview.ready, false);
    assert.equal(preview.xml, null);
    assert.ok(preview.errors.length > 0);
  });

  it("XML download endpoint returns attachment", async () => {
    const listing = await createValidListing();
    const response = await getCianPreview(
      authedRequest(
        `http://localhost/api/long-term-listings/${listing.id}/publications/cian/preview?download=1`,
        authCookie,
      ),
      { params: Promise.resolve({ id: listing.id }) },
    );
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("content-type")?.includes("application/xml"));
    assert.ok(response.headers.get("content-disposition")?.includes(`cian-${listing.id}.xml`));
    const body = await response.text();
    assert.match(body, /<Feed>/);
  });

  it("preview endpoint returns structured errors without XML", async () => {
    const listing = await createValidListing();
    await updateLongTermListing(listing.id, { monthlyPrice: 0 });
    const response = await getCianPreview(
      authedRequest(
        `http://localhost/api/long-term-listings/${listing.id}/publications/cian/preview`,
        authCookie,
      ),
      { params: Promise.resolve({ id: listing.id }) },
    );
    assert.equal(response.status, 422);
    const body = (await response.json()) as { ready: boolean; xml: null; errors: unknown[] };
    assert.equal(body.ready, false);
    assert.equal(body.xml, null);
    assert.ok(body.errors.length > 0);
  });

  it("normalizedHash and cianPayloadHash deterministic; price changes payload hash", () => {
    const first = makeNormalizedCianFixture();
    const second = makeNormalizedCianFixture();
    assert.equal(
      hashNormalizedLongTermPublicationData(first),
      hashNormalizedLongTermPublicationData(second),
    );

    const previewA = buildCianListingPreview({
      id: first.listingId,
      status: "ACTIVE",
      monthlyPrice: first.monthlyPrice,
      specialOfferPrice: first.specialOfferPrice,
      specialOfferText: first.specialOfferText,
      deposit: first.deposit,
      commission: first.commission,
      minimumRentalPeriod: first.minimumRentalPeriodMonths,
      marketingTitle: first.title,
      description: first.description,
      rentalTerms: "",
      infrastructureDescription: "",
      securityDescription: "",
      parkingDescription: "",
      transportDescription: "",
      advantagesDescription: "",
      publicationContactName: first.contact.name,
      publicationPhoneCountryCode: first.contact.phoneCountryCode,
      publicationPhoneNumber: first.contact.phoneNumber,
      property: first.property,
      photos: first.photos.map((photo) => ({
        included: true,
        sortOrder: photo.order,
        photo: { id: photo.id, url: photo.url },
      })),
    });
    assert.equal(previewA.ready, true);
    const hash1 = previewA.cianPayloadHash!;

    const previewB = buildCianListingPreview({
      id: first.listingId,
      status: "ACTIVE",
      monthlyPrice: first.monthlyPrice,
      specialOfferPrice: first.specialOfferPrice,
      specialOfferText: first.specialOfferText,
      deposit: first.deposit,
      commission: first.commission,
      minimumRentalPeriod: first.minimumRentalPeriodMonths,
      marketingTitle: first.title,
      description: first.description,
      rentalTerms: "",
      infrastructureDescription: "",
      securityDescription: "",
      parkingDescription: "",
      transportDescription: "",
      advantagesDescription: "",
      publicationContactName: first.contact.name,
      publicationPhoneCountryCode: first.contact.phoneCountryCode,
      publicationPhoneNumber: first.contact.phoneNumber,
      property: first.property,
      photos: first.photos.map((photo) => ({
        included: true,
        sortOrder: photo.order,
        photo: { id: photo.id, url: photo.url },
      })),
    });
    assert.equal(previewB.cianPayloadHash, hash1);
    assert.equal(hashCianFlatRentPayload(previewA.payload!), hash1);

    const previewC = buildCianListingPreview({
      id: first.listingId,
      status: "ACTIVE",
      monthlyPrice: 71000,
      specialOfferPrice: first.specialOfferPrice,
      specialOfferText: first.specialOfferText,
      deposit: first.deposit,
      commission: first.commission,
      minimumRentalPeriod: first.minimumRentalPeriodMonths,
      marketingTitle: first.title,
      description: first.description,
      rentalTerms: "",
      infrastructureDescription: "",
      securityDescription: "",
      parkingDescription: "",
      transportDescription: "",
      advantagesDescription: "",
      publicationContactName: first.contact.name,
      publicationPhoneCountryCode: first.contact.phoneCountryCode,
      publicationPhoneNumber: first.contact.phoneNumber,
      property: first.property,
      photos: first.photos.map((photo) => ({
        included: true,
        sortOrder: photo.order,
        photo: { id: photo.id, url: photo.url },
      })),
    });
    assert.equal(previewC.ready, true);
    assert.notEqual(previewC.cianPayloadHash, hash1);
  });

  it("invalid batch item не ломает valid item; XML escaping", async () => {
    const valid = await createValidListing();
    const other = await prisma.property.create({
      data: {
        name: "Без этажа",
        slug: `no-floor-${Date.now()}`,
        type: "APARTMENT",
        status: "ACTIVE",
        address: "ул. Другая, д. 2",
        city: "Тестовый город",
        district: "Район Б",
        area: 30,
        rooms: 1,
        bedrooms: 1,
        bathrooms: 1,
        floor: null,
        guests: 2,
        description: "Тест",
        shortDescription: "Тест",
        ownerName: "Владелец",
        ownerPhone: "+7 000 000-00-02",
        managementType: "OWN",
      },
    });
    const invalidCreated = await createLongTermListing({ propertyId: other.id });
    const invalid = await updateLongTermListing(invalidCreated.listing.id, {
      monthlyPrice: 50000,
      description: "Достаточно длинное описание для baseline и CIAN проверки.",
      publicationContactName: "Анна",
      publicationPhoneCountryCode: "7",
      publicationPhoneNumber: "9001234567",
    });

    const feed = prepareCianFeed([valid, invalid]);
    assert.equal(feed.validItems.length, 1);
    assert.equal(feed.validItems[0].externalId, valid.id);
    assert.equal(feed.invalidItems.length, 1);
    assert.equal(feed.invalidItems[0].listingId, invalid.id);
    assert.match(feed.xml, new RegExp(`<ExternalId>${valid.id}</ExternalId>`));
    assert.equal(feed.xml.includes(invalid.id), false);

    const escaped = await updateLongTermListing(valid.id, {
      description: 'Квартира & море <центр> "тест" длинное описание.',
    });
    const preview = buildCianListingPreview(escaped);
    assert.equal(preview.ready, true);
    assert.match(preview.xml!, /&amp;/);
    assert.match(preview.xml!, /&lt;центр&gt;/);
  });

  it("cian feed preview route isolates ids", async () => {
    const valid = await createValidListing();
    const response = await getCianFeedPreview(
      authedRequest(`http://localhost/api/crm/cian-feed-preview?ids=${valid.id}`, authCookie),
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      validCount: number;
      invalidCount: number;
      xml: string;
    };
    assert.equal(body.validCount, 1);
    assert.equal(body.invalidCount, 0);
    assert.match(body.xml, /<Feed>/);
  });
});
