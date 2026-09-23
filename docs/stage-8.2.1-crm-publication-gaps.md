# Stage 8.2.1 — CRM Publication Gaps

**Access date:** 2026-09-21  
**Basis:** current Prisma models only + provider contracts in `docs/stage-8.2.1-provider-contracts.md`  
**No Prisma changes in this stage.** Proposed fields are documentation only.

---

## 1. Model inventory (as-is)

### Property

| Field | Type | Notes |
|---|---|---|
| `floor` | `Int?` | **nullable** |
| `totalFloors` | `Int?` | nullable |
| `area` | `Float` | required |
| `rooms` | `Int` | required |
| `bedrooms` | `Int` | required |
| `bathrooms` | `Int` | required (not split) |
| `address`, `city`, `district` | `String` | required |
| `ownerName`, `ownerPhone` | `String` | unstructured phone |
| `type` | enum | APARTMENT/STUDIO/HOUSE/… |
| lat/lng | — | **absent** |
| countryCode | — | **absent** |

### PropertyPhoto

| Field | Type | Notes |
|---|---|---|
| `url` | `String` | no absolute/HTTPS/public guarantee |
| `caption` | `String?` | |
| `sortOrder` | `Int` | |
| mime / width / height / checksum / version | — | **absent** |

### LongTermListing

| Field | Type | Notes |
|---|---|---|
| `monthlyPrice` | `Int` | SoT for LT price |
| `deposit` | `Int` | |
| `commission` | `Float` | %; payee semantics undefined |
| `minimumRentalPeriod` | `Int` | months-like; provider mapping unclear |
| marketing + description blocks | `String` | |
| `status` | DRAFT/ACTIVE/PAUSED/ARCHIVED | |

### LongTermListingPhoto

`photoId`, `sortOrder`, `included` — selection layer OK.

### Publication

`status`, `externalId` (provider-assigned), `externalStatus`, last* — no `clientExternalId`, no payload hash.

### SalesChannel

Codes include AVITO / CIAN / DOMCLICK.

### Not used for publication contacts

`Guest.*` — explicitly excluded.

---

## 2. Floor audit

| Question | Answer |
|---|---|
| Do we have floor? | Yes — `Property.floor` |
| Can it be null? | **Yes** (`Int?`) |
| Do providers require it? | **CIAN archived XSD:** `FloorNumber` **required**. **Avito realty:** UNKNOWN. **Domclick:** UNKNOWN |
| Does provider allow unknown floor? | CIAN archived schema: no optional FloorNumber. Live schema unread |

**Verdict:** If implementing CIAN against archived XSD, null `floor` ⇒ **P0 DATA GAP**.  
Priority holds only while CIAN schema requires FloorNumber (archived CONFIRMED; live ACCOUNT_ACCESS_REQUIRED to reconfirm).

---

## 3. Contact data audit

| Need | Current storage | Gap? |
|---|---|---|
| Publication phone | `Property.ownerPhone` (free string) | Parse risk |
| Contact name | `Property.ownerName` | Present |
| Country code | **none** | Gap for CIAN `CountryCode` |
| Email | **none** on Property/LongTermListing | Optional for CIAN |
| Dedicated agency publication phone | **none** | Product gap (may differ from owner) |

**Guest must not be used.**

---

## 4. Deposit / commission semantics

| CRM | CIAN (archived) | Avito realty | Domclick |
|---|---|---|---|
| `LongTermListing.deposit` | `BargainTerms.Deposit` OPTIONAL | UNKNOWN tag | UNKNOWN |
| `LongTermListing.commission` | `ClientFee` **or** `AgentFee` (both OPTIONAL %) | UNKNOWN | UNKNOWN |

**MAPPING_BLOCKED:** CRM `commission` does not state whether it is tenant fee, agent fee, or internal management fee (`Property.commissionMonthly` is a separate economic field and is **not** LT SoT).

Do not map `commission → ClientFee` or `AgentFee` until product defines meaning and provider docs/account confirm.

Deposit: optional on CIAN archived schema → not P0; mapping possible when product confirms units (currency integer).

---

## 5. Provider field vs CRM (CIAN archived reference)

| Provider field | Required? | Current source | Type match | Transformation possible? | Missing? |
|---|---|---|---|---|---|
| ExternalId | yes | LongTermListing.id candidate | string/cuid | yes | no |
| Category flatRent | yes | Property.type | enum→const | yes for apartment/studio | house needs other category |
| Description | yes | LT text fields | string | concatenate | no |
| Address | yes | Property.address/city | string | format UNKNOWN live | no |
| Coordinates | optional | — | — | — | **yes** (not P0) |
| FlatRoomsCount | yes | Property.rooms | int | yes; studio UNKNOWN | no |
| TotalArea | yes | Property.area | float→double | yes | no |
| FloorNumber | yes | Property.floor | Int?→int | **fails if null** | **P0 when null** |
| BedsCount | yes | Property.bedrooms? | int | semantic UNKNOWN | semantic gap |
| Building | yes element | totalFloors optional child | — | emit Building | no |
| BargainTerms.Price | yes | monthlyPrice | int→double | yes | no |
| Deposit | optional | deposit | int | yes | no |
| ClientFee/AgentFee | optional | commission | float→int % | **MAPPING_BLOCKED** | semantic |
| Phones.CountryCode/Number | yes | ownerPhone | string | parse fragile | structured fields missing |
| Photos/FullUrl | optional XSD | PropertyPhoto.url | string | only if public absolute URL | infrastructure |
| Title | optional | marketingTitle | string | length UNKNOWN | no |
| LeaseTermType | optional | minimumRentalPeriod | — | UNKNOWN | mapping |

Avito realty columns: **all payload fields UNKNOWN** until template access.  
Domclick: **all UNKNOWN**.

---

## 6. P0 gaps (valid payload cannot be created)

Definition: without this, a **schema-valid / contract-valid** provider payload cannot be produced.

| Gap | Provider | Why P0 | Confirmed by |
|---|---|---|---|
| `Property.floor` nullable vs required `FloorNumber` | CIAN (archived) | Cannot emit required integer when null | archived XSD |
| Live CIAN schema unavailable | CIAN | Cannot freeze implementable field set | captcha |
| CIAN unpublish semantics | CIAN | Cannot complete publication lifecycle contract | blocked confirmation |
| Avito realty Autoload template | Avito | Cannot serialize LT apartment at all | captcha / ACCOUNT_ACCESS |
| Domclick LT schema | Domclick | Cannot serialize | DOCUMENTATION_BLOCKED |

### Downgrades vs Stage 8.2.0

| Candidate | Stage 8.2.0 | Stage 8.2.1 |
|---|---|---|
| Public HTTPS photo URL | P0 | **Not P0 for CIAN schema-min** (`Photos` optional in archived XSD). Remains **PHOTO_INFRASTRUCTURE_BLOCKER** when photos are included / for production quality. Avito/Domclick photo necessity **UNKNOWN** |
| Coordinates | often treated critical | **OPTIONAL** CIAN archived → **P2** |
| Deposit | — | **OPTIONAL** CIAN → not P0 |
| Commission | — | optional + **MAPPING_BLOCKED** → P1 semantic |
| Phone | — | required Phones but string exists → **P1** (parse/CountryCode), not absent-field P0 |
| Avito-specific fields | P0-ish | **P0 documentation** (template), not CRM column |

---

## 7. P1 gaps

| Gap | Provider | Notes |
|---|---|---|
| Structured phone CountryCode/Number | CIAN | ownerPhone parse |
| BedsCount semantics | CIAN | bedrooms may be wrong |
| Commission payee mapping | CIAN | ClientFee vs AgentFee |
| Studio → FlatRoomsCount | CIAN | UNKNOWN live |
| Description length/HTML rules | CIAN | live UNKNOWN |
| Dedicated publication contact vs owner | all | product |
| Public photo URLs for included photos | CIAN/Avito | infrastructure |
| Autoload OAuth scopes | Avito | account |
| Stable feed id separate from Publication.externalId | CIAN/Avito | architecture (optional schema later) |

---

## 8. P2 gaps

| Gap | Provider |
|---|---|
| lat/lng | CIAN optional |
| living/kitchen area, repair, amenities, cadastral | CIAN optional |
| Title premium rules | CIAN |
| LeaseTermType / PrepayMonths | CIAN |
| Email | CIAN optional |

---

## 9. Proposed future schema changes (DO NOT IMPLEMENT)

Document-only proposals if later stages need them:

| Proposal | Why |
|---|---|
| Enforce `Property.floor` non-null when creating ACTIVE LT listing destined for CIAN | P0 CIAN FloorNumber |
| `publicationPhone` / `phoneCountryCode` on Property or LongTermListing | CIAN Phones; avoid Guest |
| `commissionPayer` enum or split tenantFee/agentFee | unblock CIAN fee mapping |
| `clientExternalId` on Publication **or** policy: Autoload/ExternalId = LongTermListing.id always | separate feed id from `externalId` |
| `lastSerializedHash` on Publication | update detection (see readiness ADR) |
| Photo public URL / CDN metadata | photo contract |

**STOP — no migrations in Stage 8.2.1.**

---

## 10. Normalized publication DTO (analysis only)

A future provider-neutral layer is **recommended** because CIAN XML and Avito Autoload differ, while CRM sources overlap.

```
LongTermListing + Property + selected PropertyPhoto
        ↓
NormalizedLongTermPublicationData   ← not coded
        ↓
CIAN / Avito / Domclick serializers  ← not coded
```

### Minimal recommended conceptual set

Include only fields justified by architecture or confirmed contracts:

| Field | Why |
|---|---|
| `stableListingId` | ExternalId / Autoload Id |
| `title` | marketingTitle |
| `description` | merged LT text |
| `monthlyPrice` | BargainTerms.Price / Autoload price |
| `deposit` | optional provider maps |
| `commission` + `commissionRole` (future) | blocked until role exists |
| `address` / `city` | Address |
| `coordinates` | optional |
| `floor` / `totalFloors` | FloorNumber / Building |
| `rooms` / `area` / `bedrooms` | counts |
| `propertyType` | category selection |
| `photos[]` { url, sortOrder, isDefault } | PhotoSchema / Autoload images |
| `contactPhone` / `contactName` / `phoneCountryCode` | Phones |

Do **not** invent TypeScript interfaces in this stage.
