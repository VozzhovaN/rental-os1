# Stage 8.2.0 — Provider Field Matrix

**Access date:** 2026-09-21  
**Companion:** `docs/stage-8.2.0-official-publication-protocol-audit.md`  

Legend for mapping cells:

| Tag | Meaning |
|---|---|
| CONFIRMED | Official evidence for provider field |
| PARTIAL | Official but incomplete / archived / category template missing |
| MISSING INTERNAL FIELD | CRM lacks data |
| TRANSFORM REQUIRED | CRM has related data; mapping/normalization needed |
| PROVIDER DOES NOT SUPPORT | Official surface lacks field/capability |
| UNKNOWN | No official evidence |

Evidence keys: A* / C* / D* from the main audit source register.

---

## 1. Identity & lifecycle

| CRM field | Avito | CIAN | Domclick | Required? | Transform | Evidence |
|---|---|---|---|---|---|---|
| `LongTermListing.id` | Autoload `Id` (candidate) | `ExternalId` (candidate) | UNKNOWN feed id | Avito/CIAN: stable id required | Prefer listing id; immutable | A3, C5 |
| `Publication.id` | alternate Autoload `Id` | alternate `ExternalId` | UNKNOWN | optional choice | must never rotate if used | architecture |
| `Publication.externalId` | Avito item id | CIAN `offerId` | UNKNOWN | after success | write only on confirm | A5/A6, C1 |
| `Publication.status` | mapped from Autoload/`avito_status` | mapped from import/offers | UNKNOWN | internal | never fake PUBLISHED | FSM |
| `LongTermListing.status` | include only ACTIVE in feed | include only ACTIVE | UNKNOWN | product rule | DRAFT/PAUSED/ARCHIVED omit | architecture |

---

## 2. Marketing content

| CRM field | Avito | CIAN | Domclick | Required? | Transform | Evidence |
|---|---|---|---|---|---|---|
| `marketingTitle` | UNKNOWN realty tag | `Title` (historical: Top/Premium only, length limits) | UNKNOWN | CIAN conditional | length clamp | C4 PARTIAL |
| `description` | UNKNOWN realty tag | `Description` | UNKNOWN | CIAN schema yes | concatenate blocks; strip HTML/`&` | C5 |
| `rentalTerms` | UNKNOWN | part of `Description` or separate UNKNOWN | UNKNOWN | optional | merge text | — |
| `infrastructureDescription` | UNKNOWN | merge into `Description` | UNKNOWN | optional | merge | — |
| `securityDescription` | UNKNOWN | merge | UNKNOWN | optional | merge | — |
| `parkingDescription` | UNKNOWN | text merge; structured `Parking.Type` MISSING | UNKNOWN | optional | TRANSFORM | C5 |
| `transportDescription` | UNKNOWN | merge | UNKNOWN | optional | merge | — |
| `advantagesDescription` | UNKNOWN | merge | UNKNOWN | optional | merge | — |
| `specialOfferPrice` | UNKNOWN | `BargainPrice`? | UNKNOWN | optional | PARTIAL semantic | C5 |
| `specialOfferText` | UNKNOWN | `BargainConditions`? | UNKNOWN | optional | PARTIAL | C5 |

---

## 3. Price & commercial terms

| CRM field | Avito | CIAN | Domclick | Required? | Transform | Evidence |
|---|---|---|---|---|---|---|
| `monthlyPrice` | UNKNOWN tag (price exists in Autoload generally) | `BargainTerms.Price` | UNKNOWN | CIAN yes | integer/double | C5; Avito PARTIAL |
| `Property.monthlyPrice` | do not use as SoT | do not use | do not use | — | ignore for LT | schema comment |
| `deposit` | UNKNOWN realty | `BargainTerms.Deposit` | UNKNOWN | CIAN optional | | C5 |
| `commission` | UNKNOWN | `ClientFee` / `AgentFee` (%) | UNKNOWN | optional | TRANSFORM — confirm who pays | C5 |
| `minimumRentalPeriod` | UNKNOWN | no direct months field; `LeaseTermType` + `PrepayMonths` | UNKNOWN | optional | TRANSFORM unclear | C5 |

---

## 4. Property physical attributes

| CRM field | Avito | CIAN | Domclick | Required? | Transform | Evidence |
|---|---|---|---|---|---|---|
| `Property.type` | Autoload category/subcategory UNKNOWN | `flatRent` / `houseRent` / … | UNKNOWN | yes | map enum | C5 |
| `Property.area` | UNKNOWN tag | `TotalArea` | UNKNOWN | CIAN yes | | C5 |
| `Property.rooms` | UNKNOWN | `FlatRoomsCount` | UNKNOWN | CIAN yes | studio mapping UNKNOWN live | C5 |
| `Property.bedrooms` | UNKNOWN | `BedsCount` (schema required) | UNKNOWN | CIAN yes | may not equal bedrooms — TRANSFORM/gap | C5 |
| `Property.bathrooms` | UNKNOWN | `SeparateWcsCount` / `CombinedWcsCount` | UNKNOWN | optional | MISSING split | C5 |
| `Property.floor` | UNKNOWN | `FloorNumber` | UNKNOWN | CIAN yes | **MISSING if null** | C5 |
| `Property.totalFloors` | UNKNOWN | `Building.FloorsCount` (optional in XSD) | UNKNOWN | optional | | C5 |
| `Property.address` | UNKNOWN / Address | `Address` | UNKNOWN | CIAN yes | Yandex-style | C5 |
| `Property.city` | UNKNOWN | part of Address | UNKNOWN | | embed | — |
| `Property.district` | UNKNOWN | no direct tag | UNKNOWN | | | — |
| lat / lng | UNKNOWN | `Coordinates.Lat/Lng` | UNKNOWN | optional | **MISSING INTERNAL FIELD** | C5 |
| living / kitchen area | UNKNOWN | `LivingArea` / `KitchenArea` | UNKNOWN | optional | **MISSING** | C5 |
| repair type | UNKNOWN | `RepairType` | UNKNOWN | optional | **MISSING** | C5 archived docs |
| building material / year | UNKNOWN | `Building.MaterialType` / `BuildYear` | UNKNOWN | optional | **MISSING** | C5 |
| amenities (pets, furniture, …) | UNKNOWN | boolean tags | UNKNOWN | optional | **MISSING** flags | C5 |
| cadastral | UNKNOWN | `CadastralNumber` | UNKNOWN | optional | **MISSING** | C5 |

---

## 5. Contacts

| CRM field | Avito | CIAN | Domclick | Required? | Transform | Evidence |
|---|---|---|---|---|---|---|
| `Property.ownerPhone` | ContactPhone / similar UNKNOWN exact tag | `Phones.PhoneSchema` | UNKNOWN | CIAN yes | CountryCode + Number | C5 |
| `Property.ownerName` | UNKNOWN | optional name fields | UNKNOWN | optional | | C5 |
| CRM user phone | UNKNOWN | may be preferred over owner | UNKNOWN | account policy | product decision | — |

---

## 6. Photos

| CRM field | Avito | CIAN | Domclick | Required? | Transform | Evidence |
|---|---|---|---|---|---|---|
| `PropertyPhoto.url` | Autoload image URL field (tag UNKNOWN) | `Photos.PhotoSchema.FullUrl` | UNKNOWN | practically required | must be absolute public HTTPS | A1 PARTIAL; C5 |
| `LongTermListingPhoto.sortOrder` | order of URLs | order + `IsDefault` | UNKNOWN | | first included → IsDefault | C5 |
| `LongTermListingPhoto.included` | filter | filter | filter | | omit false | architecture |
| `PropertyPhoto.caption` | UNKNOWN | UNKNOWN | UNKNOWN | optional | | — |
| mime / width / height / checksum | UNKNOWN limits | historical size/format limits PARTIAL | UNKNOWN | | **MISSING INTERNAL** metadata | C4 PARTIAL |
| versioned URL on binary change | UNKNOWN | historically required new URL | UNKNOWN | | CDN strategy | C4 PARTIAL |

---

## 7. Feed envelope (not CRM fields)

| Concept | Avito | CIAN | Domclick |
|---|---|---|---|
| Root | `Ads` + `formatVersion="3"` + `target="Avito.ru"` (**CONFIRMED** A3) | `feed` / `feed_version=2` (**CONFIRMED** C5) | UNKNOWN |
| Item node | `Ad` (**CONFIRMED** A3) | `object` (**CONFIRMED** C5) | UNKNOWN |
| Category | per-template (**NOT CONFIRMED** for flat rent) | `flatRent` (**CONFIRMED** C5) | UNKNOWN |
| Delivery | HTTPS feed URL in Autoload profile (**CONFIRMED** A5) | registered permanent URL (**PARTIAL** C1/C4) | URL in partner LK (**NOT CONFIRMED** officially this session) |

---

## 8. Matrix: internal → provider readiness

| Internal field | Avito readiness | CIAN readiness | Domclick readiness |
|---|---|---|---|
| Stable listing id | PARTIAL (Id rules OK) | CONFIRMED ExternalId | UNKNOWN |
| Title | UNKNOWN | PARTIAL | UNKNOWN |
| Description | UNKNOWN | CONFIRMED + TRANSFORM | UNKNOWN |
| Monthly price | PARTIAL | CONFIRMED | UNKNOWN |
| Deposit | UNKNOWN | CONFIRMED optional | UNKNOWN |
| Commission | UNKNOWN | TRANSFORM / semantic risk | UNKNOWN |
| Address | UNKNOWN | CONFIRMED | UNKNOWN |
| Coordinates | UNKNOWN | MISSING INTERNAL | UNKNOWN |
| Rooms / area / floor | UNKNOWN | CONFIRMED / floor null P0 | UNKNOWN |
| Photos public URL | P0 BLOCKER | P0 BLOCKER | P0 BLOCKER |
| Phone | UNKNOWN | TRANSFORM REQUIRED | UNKNOWN |

---

## 9. Explicit non-mappings

| Do not map | Why |
|---|---|
| `ChannelListing.externalId` → LT feed | Different product contour |
| STR Avito booking scopes → Autoload create | Different capability |
| Domclick stats `offer_id` → publication success | No proven link |
| New-build Domclick JK XML → secondary LT rent | Different schema domain |
| `Property.monthlyPrice` → provider price | LongTermListing is SoT |
