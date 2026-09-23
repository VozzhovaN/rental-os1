# Stage 8.2.3 — CIAN Serializer Contract

**Project:** rental-os  
**Stage:** 8.2.3  
**Type:** IMPLEMENTATION / PROVIDER SERIALIZATION  
**Date:** 2026-09-21  

Serializer-only. Нет HTTP к CIAN, нет credentials, нет feed URL, нет мутации Publication.

---

## Target

| Item | Value |
|---|---|
| Provider | CIAN |
| Category | `flatRent` |
| Transport | XML feed (in-memory generation only) |
| Feed version | **2** (`Feed_Version`) |
| Contract basis | Archived official `flatRent.xsd` (2023-07-11) + Stage 8.0/8.2.1 docs; live XSD still ACCOUNT_ACCESS_REQUIRED |
| Supported Property.type | `APARTMENT`, `STUDIO` |
| Unsupported | `HOUSE`, `OTHER` → `CIAN_UNSUPPORTED_PROPERTY_TYPE` |

---

## Pipeline

```
LongTermListing
  → buildNormalizedLongTermPublicationData()
  → validateLongTermPublicationReadiness()   // Stage 8.2.2 baseline
  → NormalizedLongTermPublicationData
  → validateCianFlatRentPublication()
  → mapToCianFlatRentPayload()
  → serializeCianFlatRentObject() / serializeCianFeed()
  → XML string
```

No DB writes. No Publication FSM changes.

Module: `lib/publications/providers/cian/`

---

## Identifier

| Item | Decision |
|---|---|
| ExternalId source | `NormalizedLongTermPublicationData.listingId` (= `LongTermListing.id`) |
| Stability | Same listing → same ExternalId across price/description/photo changes |
| Persistence | **Not** written to `Publication.externalId` on this stage |

---

## Field mapping

| Internal source | CIAN field | Status | Notes |
|---|---|---|---|
| `listingId` | `ExternalId` | MAPPED | Stable listing id |
| constant | `Category` | MAPPED | `flatRent` only |
| `description` | `Description` | MAPPED | 15–3000 chars; no silent truncate |
| `property.city` + `property.address` | `Address` | MAPPED | Deterministic join; no geocoding |
| `property.rooms` | `FlatRoomsCount` | MAPPED | Studio uses raw rooms (no invented FlatRoomsCount=9) |
| `property.area` | `TotalArea` | MAPPED | Machine decimal format |
| `property.floor` | `FloorNumber` | MAPPED | Required; null → error |
| `property.totalFloors` | `Building.FloorsCount` | MAPPED | Optional child; Building element always present |
| `monthlyPrice` | `BargainTerms.Price` | MAPPED | Must be > 0 |
| constant | `BargainTerms.Currency` | MAPPED | `rur` (Stage 8.2.3 policy; live Currency confirmation UNKNOWN) |
| `deposit` (>0) | `BargainTerms.Deposit` | MAPPED | Security deposit; `0` → omit tag |
| constant | `BargainTerms.LeaseTermType` | MAPPED | Always `longTerm` for LT contour |
| `contact.phoneCountryCode` / `phoneNumber` | `Phones.PhoneSchema.*` | MAPPED | Publication contact only |
| selected photos | `Photos.PhotoSchema.FullUrl` | MAPPED | Public HTTPS only |
| first photo | `IsDefault=true` | MAPPED | Confirmed optional in archived XSD |
| `commission` | `ClientFee` | **BLOCKED** | MAPPING_BLOCKED |
| `commission` | `AgentFee` | **BLOCKED** | MAPPING_BLOCKED |
| `title` | `Title` | UNMAPPED | Premium-only rules UNKNOWN |
| `contact.name` | (any name tag) | UNMAPPED | Agent ≠ owner; no HomeOwnerName guess |
| `specialOfferPrice/Text` | BargainPrice/… | UNMAPPED | No confirmed discount semantics |
| `minimumRentalPeriodMonths` | LeaseTermType/PrepayMonths | UNMAPPED | Separate from LeaseTermType=longTerm |
| `property.bedrooms` | `BedsCount` | UNMAPPED | Required in archived XSD but beds vs bedrooms UNKNOWN — omit rather than invent |
| coordinates | `Coordinates` | NOT_APPLICABLE | No CRM fields |
| Guest/owner phone | Phones | NOT_APPLICABLE | Forbidden sources |

---

## Commission policy

Never emit `ClientFee` or `AgentFee` from generic `commission`.

If `commission !== 0` and `commissionMapping = MAPPING_BLOCKED`:

- warning `CIAN_COMMISSION_MAPPING_UNRESOLVED`
- XML generation **not** blocked (fees optional in archived schema)

---

## Deposit

Mapped as integer security deposit when `deposit > 0`.  
`deposit = 0` → tag omitted (treated as absent for feed).

---

## Lease term

`LeaseTermType = longTerm` hardcoded for long-term contour.  
`minimumRentalPeriodMonths` does **not** drive `fewMonths`.

---

## Contact

Phone: publication contact only.  
Name: not serialized (warning `CIAN_CONTACT_NAME_UNMAPPED` when present).

---

## Photos

- Only selected long-term photos (already filtered in normalized DTO)
- Order preserved
- Public HTTPS via Stage 8.2.2 `isPublicPublicationPhotoUrl`
- Max 50 (`CIAN_TOO_MANY_PHOTOS`)
- Zero photos: warning `CIAN_NO_PHOTOS`, XML without `<Photos>`
- No network fetch/upload/CDN

---

## Description length

From Stage 8.0 official CIAN doc excerpt:

- min **15**
- max **3000**

Errors: `CIAN_DESCRIPTION_TOO_SHORT` / `CIAN_DESCRIPTION_TOO_LONG`. No truncation.

---

## Validation codes

Errors (block XML):

- `CIAN_UNSUPPORTED_PROPERTY_TYPE`
- `CIAN_MISSING_ADDRESS`
- `CIAN_MISSING_FLOOR`
- `CIAN_INVALID_PRICE`
- `CIAN_DESCRIPTION_TOO_SHORT`
- `CIAN_DESCRIPTION_TOO_LONG`
- `CIAN_INVALID_PHONE`
- `CIAN_PHOTO_URL_NOT_PUBLIC`
- `CIAN_TOO_MANY_PHOTOS`
- `CIAN_INVALID_AREA`
- `CIAN_INVALID_ROOMS`

Warnings (do not block):

- `CIAN_COMMISSION_MAPPING_UNRESOLVED`
- `CIAN_NO_PHOTOS`
- `CIAN_SPECIAL_OFFER_UNMAPPED`
- `CIAN_TITLE_UNMAPPED`
- `CIAN_MINIMUM_RENTAL_PERIOD_UNMAPPED`
- `CIAN_CONTACT_NAME_UNMAPPED`

Fail closed: `mapToCianFlatRentPayload` throws `CianSerializationError` if errors present.

---

## XML serialization rules

- Safe escaping: `& < > " '`
- Optional null → omit tag (no empty optional tags)
- Numbers: machine format, no locale spaces/commas
- Deterministic tag order and whitespace
- Feed: `Feed` / `Feed_Version=2` / `Object`…
- No timestamps / random ids

Batch:

- `prepareCianFeedItems(items)` → `{ validItems, invalidItems }`
- `serializeCianFeed(validItems)` does **not** silently drop invalid payloads

---

## Known contract gaps

1. Live `flatRent.xsd` still captcha-blocked — serializer frozen on archived snapshot + Stage docs.
2. `BedsCount` required in archived XSD but semantics UNKNOWN → not emitted (schema-min risk until confirmed).
3. Studio → special FlatRoomsCount (historically 9) not applied.
4. Currency tag included as `rur` per Stage 8.2.3 policy; archived inventory table did not list Currency separately.
5. Unpublish / status / feed delivery / credentials — out of scope.

---

## Non-goals

- NO CIAN HTTP / API
- NO credentials / ACCESS KEY
- NO public feed URL
- NO `/publish` `/unpublish` `/sync`
- NO Publication.status / externalId mutation
- NO Avito long-term / Domclick
- NO UI publish button
- NO Prisma migration
