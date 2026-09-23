import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  CianSerializationError,
  mapToCianFlatRentPayload,
  prepareCianFeedItems,
  resolveCianExternalId,
  serializeCianFeed,
  serializeCianFlatRentObject,
  validateCianFlatRentPublication,
} from "@/lib/publications/providers/cian";
import { makeNormalizedCianFixture } from "../helpers/cian-fixtures";

const goldenXml = readFileSync(join(process.cwd(), "tests/fixtures/cian-flat-rent-valid.xml"), "utf8");

describe("cian flatRent serializer", () => {
  it("valid apartment -> valid CIAN payload", () => {
    const data = makeNormalizedCianFixture();
    const validation = validateCianFlatRentPublication(data);
    assert.equal(validation.valid, true);
    const payload = mapToCianFlatRentPayload(data);
    assert.equal(payload.category, "flatRent");
    assert.equal(payload.price, 70000);
    assert.equal(payload.currency, "rur");
    assert.equal(payload.leaseTermType, "longTerm");
    assert.equal(payload.floorNumber, 4);
    assert.equal(payload.flatRoomsCount, 1);
    assert.equal(payload.totalArea, 42);
  });

  it("valid studio maps to flatRent", () => {
    const data = makeNormalizedCianFixture({
      listingId: "studio-1",
      property: { type: "STUDIO", rooms: 1, floor: 3 },
    });
    const payload = mapToCianFlatRentPayload(data);
    assert.equal(payload.category, "flatRent");
    assert.equal(payload.flatRoomsCount, 1);
  });

  it("ExternalId стабилен при смене цены/описания/фото", () => {
    const base = makeNormalizedCianFixture();
    const externalId = resolveCianExternalId(base);
    assert.equal(externalId, "listing-golden-001");
    assert.equal(mapToCianFlatRentPayload(base).externalId, externalId);

    const withPrice = makeNormalizedCianFixture({ monthlyPrice: 71000 });
    const withDescription = makeNormalizedCianFixture({
      description: "Другое описание квартиры для публикации на длительный срок.",
    });
    const withPhotos = makeNormalizedCianFixture({
      photos: [
        {
          id: "photo-b",
          url: "https://cdn.example.com/b.jpg",
          order: 0,
          isPrimary: true,
        },
      ],
    });

    assert.equal(mapToCianFlatRentPayload(withPrice).externalId, externalId);
    assert.equal(mapToCianFlatRentPayload(withDescription).externalId, externalId);
    assert.equal(mapToCianFlatRentPayload(withPhotos).externalId, externalId);
  });

  it("Category = flatRent, monthlyPrice -> Price, Currency = rur, LeaseTermType = longTerm", () => {
    const payload = mapToCianFlatRentPayload(makeNormalizedCianFixture());
    assert.equal(payload.category, "flatRent");
    assert.equal(payload.price, 70000);
    assert.equal(payload.currency, "rur");
    assert.equal(payload.leaseTermType, "longTerm");
    const xml = serializeCianFlatRentObject(payload);
    assert.match(xml, /<Category>flatRent<\/Category>/);
    assert.match(xml, /<Price>70000<\/Price>/);
    assert.match(xml, /<Currency>rur<\/Currency>/);
    assert.match(xml, /<LeaseTermType>longTerm<\/LeaseTermType>/);
  });

  it("deposit mapped when > 0 and omitted when 0", () => {
    const withDeposit = mapToCianFlatRentPayload(makeNormalizedCianFixture({ deposit: 70000 }));
    assert.equal(withDeposit.deposit, 70000);
    assert.match(serializeCianFlatRentObject(withDeposit), /<Deposit>70000<\/Deposit>/);

    const withoutDeposit = mapToCianFlatRentPayload(makeNormalizedCianFixture({ deposit: 0 }));
    assert.equal(withoutDeposit.deposit, null);
    assert.equal(serializeCianFlatRentObject(withoutDeposit).includes("<Deposit>"), false);
  });

  it("commission does NOT populate ClientFee or AgentFee", () => {
    const payload = mapToCianFlatRentPayload(
      makeNormalizedCianFixture({ commission: 50 }),
    );
    const xml = serializeCianFlatRentObject(payload);
    assert.equal(xml.includes("ClientFee"), false);
    assert.equal(xml.includes("AgentFee"), false);
    const validation = validateCianFlatRentPublication(
      makeNormalizedCianFixture({ commission: 50 }),
    );
    assert.ok(validation.warnings.some((item) => item.code === "CIAN_COMMISSION_MAPPING_UNRESOLVED"));
  });

  it("missing floor -> error", () => {
    const validation = validateCianFlatRentPublication(
      makeNormalizedCianFixture({ property: { floor: null } }),
    );
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((item) => item.code === "CIAN_MISSING_FLOOR"));
    assert.throws(
      () => mapToCianFlatRentPayload(makeNormalizedCianFixture({ property: { floor: null } })),
      (error: unknown) => error instanceof CianSerializationError,
    );
  });

  it("unsupported Property type -> error", () => {
    const house = validateCianFlatRentPublication(
      makeNormalizedCianFixture({ property: { type: "HOUSE", floor: 1 } }),
    );
    assert.equal(house.valid, false);
    assert.ok(house.errors.some((item) => item.code === "CIAN_UNSUPPORTED_PROPERTY_TYPE"));

    const other = validateCianFlatRentPublication(
      makeNormalizedCianFixture({ property: { type: "OTHER", floor: 1 } }),
    );
    assert.ok(other.errors.some((item) => item.code === "CIAN_UNSUPPORTED_PROPERTY_TYPE"));
  });

  it("missing address -> error", () => {
    const validation = validateCianFlatRentPublication(
      makeNormalizedCianFixture({ property: { address: "", city: "" } }),
    );
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((item) => item.code === "CIAN_MISSING_ADDRESS"));
  });

  it("invalid phone -> error", () => {
    const validation = validateCianFlatRentPublication(
      makeNormalizedCianFixture({
        contact: { name: "Анна", phoneCountryCode: "7", phoneNumber: "abc" },
      }),
    );
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((item) => item.code === "CIAN_INVALID_PHONE"));
  });

  it("no photos -> warning and still serializable", () => {
    const data = makeNormalizedCianFixture({ photos: [] });
    const validation = validateCianFlatRentPublication(data);
    assert.equal(validation.valid, true);
    assert.ok(validation.warnings.some((item) => item.code === "CIAN_NO_PHOTOS"));
    const xml = serializeCianFlatRentObject(mapToCianFlatRentPayload(data));
    assert.equal(xml.includes("<Photos>"), false);
  });

  it("invalid photo URL -> error", () => {
    const validation = validateCianFlatRentPublication(
      makeNormalizedCianFixture({
        photos: [
          {
            id: "local",
            url: "https://localhost/a.jpg",
            order: 0,
            isPrimary: true,
          },
        ],
      }),
    );
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((item) => item.code === "CIAN_PHOTO_URL_NOT_PUBLIC"));
  });

  it("photo order preserved and first is default", () => {
    const payload = mapToCianFlatRentPayload(makeNormalizedCianFixture());
    assert.deepEqual(
      payload.photos.map((photo) => photo.fullUrl),
      ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"],
    );
    assert.equal(payload.photos[0].isDefault, true);
    assert.equal(payload.photos[1].isDefault, false);
  });

  it("XML escapes special characters", () => {
    const data = makeNormalizedCianFixture({
      description: 'Квартира & море <центр> "тест" \'ок\' длинное описание.',
    });
    const xml = serializeCianFlatRentObject(mapToCianFlatRentPayload(data));
    assert.match(xml, /&amp;/);
    assert.match(xml, /&lt;центр&gt;/);
    assert.match(xml, /&quot;тест&quot;/);
    assert.match(xml, /&apos;ок&apos;/);
    assert.equal(xml.includes("<центр>"), false);
  });

  it("same input -> identical XML; price/description change XML", () => {
    const first = serializeCianFeed([mapToCianFlatRentPayload(makeNormalizedCianFixture())]);
    const second = serializeCianFeed([mapToCianFlatRentPayload(makeNormalizedCianFixture())]);
    assert.equal(first, second);

    const priceXml = serializeCianFeed([
      mapToCianFlatRentPayload(makeNormalizedCianFixture({ monthlyPrice: 71000 })),
    ]);
    assert.notEqual(priceXml, first);

    const descriptionXml = serializeCianFeed([
      mapToCianFlatRentPayload(
        makeNormalizedCianFixture({
          description: "Другое описание квартиры для публикации на длительный срок.",
        }),
      ),
    ]);
    assert.notEqual(descriptionXml, first);
  });

  it("optional undefined tags omitted; Building FloorsCount omitted when null", () => {
    const payload = mapToCianFlatRentPayload(
      makeNormalizedCianFixture({
        deposit: 0,
        property: { totalFloors: null },
        photos: [],
      }),
    );
    const xml = serializeCianFlatRentObject(payload);
    assert.equal(xml.includes("<Deposit>"), false);
    assert.equal(xml.includes("<FloorsCount>"), false);
    assert.equal(xml.includes("<Photos>"), false);
    assert.match(xml, /<Building>\s*<\/Building>/);
  });

  it("invalid payload cannot serialize via mapper", () => {
    assert.throws(
      () =>
        mapToCianFlatRentPayload(
          makeNormalizedCianFixture({
            description: "коротко",
          }),
        ),
      (error: unknown) =>
        error instanceof CianSerializationError &&
        error.errors.some((item) => item.code === "CIAN_DESCRIPTION_TOO_SHORT"),
    );
  });

  it("description too long -> error", () => {
    const validation = validateCianFlatRentPublication(
      makeNormalizedCianFixture({ description: "а".repeat(3001) }),
    );
    assert.ok(validation.errors.some((item) => item.code === "CIAN_DESCRIPTION_TOO_LONG"));
  });

  it("multi-object feed preserves item order", () => {
    const first = mapToCianFlatRentPayload(makeNormalizedCianFixture({ listingId: "a" }));
    const second = mapToCianFlatRentPayload(makeNormalizedCianFixture({ listingId: "b" }));
    const xml = serializeCianFeed([first, second]);
    const indexA = xml.indexOf("<ExternalId>a</ExternalId>");
    const indexB = xml.indexOf("<ExternalId>b</ExternalId>");
    assert.ok(indexA >= 0 && indexB > indexA);
  });

  it("prepareCianFeedItems isolates invalid listing", () => {
    const valid = makeNormalizedCianFixture({ listingId: "ok-1" });
    const invalid = makeNormalizedCianFixture({
      listingId: "bad-1",
      property: { floor: null },
    });
    const prepared = prepareCianFeedItems([valid, invalid]);
    assert.equal(prepared.validItems.length, 1);
    assert.equal(prepared.validItems[0].externalId, "ok-1");
    assert.equal(prepared.invalidItems.length, 1);
    assert.equal(prepared.invalidItems[0].listingId, "bad-1");
    assert.ok(prepared.invalidItems[0].errors.some((item) => item.code === "CIAN_MISSING_FLOOR"));

    const feed = serializeCianFeed(prepared.validItems);
    assert.match(feed, /<ExternalId>ok-1<\/ExternalId>/);
    assert.equal(feed.includes("bad-1"), false);
  });

  it("golden XML fixture matches generated feed", () => {
    const generated = serializeCianFeed([mapToCianFlatRentPayload(makeNormalizedCianFixture())]);
    assert.equal(generated, goldenXml.replace(/\r\n/g, "\n"));
  });

  it("special offer produces warning and is not serialized", () => {
    const data = makeNormalizedCianFixture({
      specialOfferPrice: 65000,
      specialOfferText: "Скидка",
    });
    const validation = validateCianFlatRentPublication(data);
    assert.ok(validation.warnings.some((item) => item.code === "CIAN_SPECIAL_OFFER_UNMAPPED"));
    const xml = serializeCianFlatRentObject(mapToCianFlatRentPayload(data));
    assert.equal(xml.includes("65000") && xml.includes("<Price>65000</Price>"), false);
    assert.match(xml, /<Price>70000<\/Price>/);
  });
});
