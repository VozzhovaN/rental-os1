# Stage 8.2.1 — Provider Contracts

**Project:** rental-os  
**Stage:** 8.2.1  
**Type:** RESEARCH / CONTRACT FREEZE / GAP VALIDATION  
**Access date:** 2026-09-21  
**Priority order:** CIAN → AVITO → DOMCLICK  

**Code freeze:** no adapters, serializers, feeds, publish APIs, Prisma changes, CDN, short-term Avito changes.

**Evidence rule:** No «probably / likely / should work / assume» inside implementation contracts.  
Blocked live docs are recorded as `ACCOUNT_ACCESS_REQUIRED` or `PROVIDER_CONFIRMATION_REQUIRED`, not guessed.

---

## 0. Access probe (this session)

| URL | Result | Classification |
|---|---|---|
| https://promo.cian.site/api | Readable | CURRENT |
| https://www.cian.ru/xml_import/doc/ | Timeout / captcha | ACCOUNT_ACCESS_REQUIRED (human/browser or partner session) |
| https://www.cian.ru/xml_import/schema/flatRent.xsd | Captcha interstitial | ACCOUNT_ACCESS_REQUIRED |
| https://support.cian.ru/.../xml-vigruzka | Captcha | ACCOUNT_ACCESS_REQUIRED |
| https://public-api.cian.ru/ | Captcha / empty shell | ACCOUNT_ACCESS_REQUIRED |
| Wayback `20230711204141` official `flatRent.xsd` | Readable XSD bytes | ARCHIVED OFFICIAL SNAPSHOT (2023-07-11) — **not live** |
| https://www.avito.ru/business/tools/autoload | Readable earlier; later 500 | CURRENT intermittent |
| https://www.avito.ru/autoload/documentation* | IP/captcha gate | ACCOUNT_ACCESS_REQUIRED |
| https://autoload.avito.ru/format/realty/ | Captcha | ACCOUNT_ACCESS_REQUIRED |
| https://developers.avito.ru/api-catalog/autoload/documentation | Captcha | ACCOUNT_ACCESS_REQUIRED |
| Autoload OpenAPI mirror quoting official catalog | Readable | MIRROR — use for version inventory only; live catalog not re-verified |
| https://wallet.domclick.ru/ | Readable | CURRENT |
| https://domclick.ru/validation | Qrator 401 | ACCOUNT_ACCESS_REQUIRED / WAF |
| https://help.domclick.ru/, https://my.domclick.ru/feeds, https://pro.domclick.ru/ | Qrator 401 | ACCOUNT_ACCESS_REQUIRED |

CAPTCHA/WAF **not bypassed**.

---

## 1. CIAN

### Outcome

**BLOCKED WITH EXACT REASON** for Stage 8.2 implementation.

Reasons:

1. `CIAN_UNPUBLISH = BLOCKED_BY_PROVIDER_CONFIRMATION`
2. Live `flatRent` docs/XSD not readable without captcha-clearing session → **ACCOUNT_ACCESS_REQUIRED** for live schema freeze
3. Create/update field contract below is frozen from **archived official XSD only** and is **not** elevated to live IMPLEMENTATION CONTRACT READY

Readiness flags:  
`PROVIDER_CONFIRMATION_REQUIRED` + `ACCOUNT_ACCESS_REQUIRED` + (after those clear) `READY_AFTER_INTERNAL_GAPS`

### Transport

| Item | Value | Status |
|---|---|---|
| Write path | XML feed | **CONFIRMED** — promo FAQ: «Автоматическая выгрузка объявлений происходит при помощи XML-файла.» (https://promo.cian.site/api) |
| REST create listing | Not publication API | **CONFIRMED** same FAQ |
| Feed delivery | Provider polls partner URL (historical docs); live onboarding text unread | **UNKNOWN** delivery auth; registration **ACCOUNT_ACCESS_REQUIRED** |
| Schema version (archived) | `feed` / `feed_version` fixed `2` / `object` / `Category=flatRent` | **CONFIRMED** in archived XSD; live currency **UNKNOWN** |

### Account requirements

| Item | Status |
|---|---|
| Agency/realtor tariff; API key in LK | **CONFIRMED** promo footnotes |
| Feed registration steps | **ACCOUNT_ACCESS_REQUIRED** (HelpDesk captcha) |

### Version note

Archived official XSD snapshot: Wayback `20230711204141` of `https://www.cian.ru/xml_import/schema/flatRent.xsd`.  
Live URL exists but returns captcha HTML. **Do not treat 2023-07-11 as live contract.**

---

### CIAN field contract (`Category = flatRent`)

Status vocabulary: **CONFIRMED** | **CONDITIONAL** | **OPTIONAL** | **UNKNOWN**  
For archived-schema rows, «CONFIRMED» means **confirmed in archived official XSD**, not live-verified.

#### Envelope

| XML field | Requirement | Type | Allowed values | Source in rental-os | Transformation | Official evidence | Status |
|---|---|---|---|---|---|---|---|
| `feed` | required root | complex | — | generated | — | archived XSD | CONFIRMED (archived) |
| `feed_version` | fixed | integer | `2` | constant | — | archived XSD | CONFIRMED (archived) |
| `object` | 1..n | complex | — | one per Publication active on CIAN | — | archived XSD | CONFIRMED (archived) |
| `Category` | fixed | string | `flatRent` | Property.type=APARTMENT/STUDIO only for this category | HOUSE → other category (out of this contract) | archived XSD | CONFIRMED (archived) |

#### Identity

| XML field | Requirement | Type | Allowed values | Source in rental-os | Transformation | Official evidence | Status |
|---|---|---|---|---|---|---|---|
| `ExternalId` | required | string | unique per feed object | candidate: `LongTermListing.id` | immutable string; no ChannelListing id | archived XSD + archived doc text (unique id) | CONFIRMED (archived) schema; create/update semantics **UNKNOWN** live wording |

#### Content / location / structure

| XML field | Requirement | Type | Allowed values | Source in rental-os | Transformation | Official evidence | Status |
|---|---|---|---|---|---|---|---|
| `Description` | required | string | — | LongTermListing description blocks | concatenate; HTML/amp rules **UNKNOWN** live | archived XSD | CONFIRMED (archived) |
| `Address` | required | string | — | Property.address (+ city) | formatting rules **UNKNOWN** live | archived XSD | CONFIRMED (archived) |
| `Coordinates` | optional | Lat/Lng doubles | — | **none** | — | archived XSD | OPTIONAL |
| `FlatRoomsCount` | required | integer | — | Property.rooms | studio special values **UNKNOWN** live | archived XSD | CONFIRMED (archived) |
| `TotalArea` | required | double | — | Property.area | — | archived XSD | CONFIRMED (archived) |
| `FloorNumber` | required | integer | — | Property.floor (`Int?`) | **null not representable** | archived XSD | CONFIRMED (archived) |
| `BedsCount` | required | integer | — | Property.bedrooms? | semantics beds vs bedrooms **UNKNOWN** | archived XSD | CONFIRMED (archived) presence; meaning UNKNOWN |
| `Building` | required element | complex | children mostly optional | Property.totalFloors → `FloorsCount` optional | may emit Building with FloorsCount | archived XSD | CONFIRMED (archived) |
| `Building.FloorsCount` | optional | integer | — | Property.totalFloors | — | archived XSD | OPTIONAL |
| `Title` | optional | string | — | marketingTitle | premium-only rules **UNKNOWN** live | archived XSD | OPTIONAL |

#### Commercial

| XML field | Requirement | Type | Allowed values | Source in rental-os | Transformation | Official evidence | Status |
|---|---|---|---|---|---|---|---|
| `BargainTerms` | required | complex | — | — | container | archived XSD | CONFIRMED (archived) |
| `BargainTerms.Price` | required | double | — | LongTermListing.monthlyPrice | — | archived XSD | CONFIRMED (archived) |
| `BargainTerms.Deposit` | optional | integer | — | LongTermListing.deposit | — | archived XSD | OPTIONAL |
| `BargainTerms.ClientFee` | optional | integer % | — | LongTermListing.commission? | **MAPPING_BLOCKED** (tenant vs agent) | archived XSD | OPTIONAL + mapping blocked |
| `BargainTerms.AgentFee` | optional | integer % | — | LongTermListing.commission? | **MAPPING_BLOCKED** | archived XSD | OPTIONAL + mapping blocked |
| `BargainTerms.LeaseTermType` | optional | enum | `fewMonths` \| `longTerm` | minimumRentalPeriod? | mapping rule **UNKNOWN** | archived XSD | OPTIONAL |
| `BargainTerms.PrepayMonths` | optional | integer | — | none dedicated | — | archived XSD | OPTIONAL |
| `PublishTerms` | optional | complex | ServicesEnum free/highlight/paid/premium/top3 | none | account packages | archived XSD | OPTIONAL |

#### Contacts

| XML field | Requirement | Type | Allowed values | Source in rental-os | Transformation | Official evidence | Status |
|---|---|---|---|---|---|---|---|
| `Phones` | required | complex | ≥1 PhoneSchema | Property.ownerPhone | split CountryCode + Number | archived XSD | CONFIRMED (archived) |
| `PhoneSchema.CountryCode` | required | string | — | not stored separately | parse from ownerPhone | archived XSD | CONFIRMED (archived) |
| `PhoneSchema.Number` | required | string | — | Property.ownerPhone | parse | archived XSD | CONFIRMED (archived) |
| `Email` / names | optional | string | — | none / ownerName | — | archived XSD | OPTIONAL |

**Guest model is not a publication contact source.**

#### Photos

| XML field | Requirement | Type | Allowed values | Source in rental-os | Transformation | Official evidence | Status |
|---|---|---|---|---|---|---|---|
| `Photos` | optional (XSD) | complex | — | LongTermListingPhoto included | — | archived XSD | OPTIONAL |
| `PhotoSchema` | required if Photos present | complex | — | each included photo | — | archived XSD | CONDITIONAL |
| `FullUrl` | optional in XSD | string | URL | PropertyPhoto.url | absolute public URL if emitted | archived XSD | OPTIONAL (XSD); product rules UNKNOWN live |
| `IsDefault` | optional | boolean | — | first included | — | archived XSD | OPTIONAL |

Live photo size/format/max count/cache policy: **UNKNOWN** (docs captcha).

---

### CREATE

| Item | Contract statement | Status |
|---|---|---|
| Transport | XML object in registered feed | CONFIRMED (transport) |
| Our identifier | `ExternalId` string we supply | CONFIRMED (archived schema) |
| Provider identifier | Distinct from ExternalId; historically `offerId` in import reports | **UNKNOWN** live API field names this session (`ACCOUNT_ACCESS_REQUIRED`) |
| New offer recognition | Official «new ExternalId creates» wording | **UNKNOWN** (not re-read live) |
| Accepted | Import report without blocking errors | **UNKNOWN** exact fields |
| Published | Offer status published (historical API enums) | **UNKNOWN** live |

Conceptual map (architecture intent; **semantics not fully CONFIRMED live**):

```
Publication
  → our stable provider ID (candidate LongTermListing.id)
  → CIAN ExternalId
  → feed processing
  → CIAN offerId (provider-assigned)
  → Publication.externalId
```

Do **not** store ExternalId and offerId in the same conceptual slot. `Publication.externalId` is reserved for **provider-assigned** id after confirmation (Stage 8.1 model comment). Stable feed id may need a separate future field — see gaps doc (**proposed only**).

### UPDATE

| Item | Contract statement | Status |
|---|---|---|
| Mechanism | same ExternalId + changed fields | **UNKNOWN** as official explicit rule (not confirmed live) |
| price / description / photos / address / contacts / deposit / fees | field-level mutability | **UNKNOWN** |
| Immutable | ExternalId must remain stable if used as identity | **CONDITIONAL** (identity role); not labeled IMMUTABLE without live text |

### UNPUBLISH — CRITICAL

| Item | Value |
|---|---|
| Official mechanism found this session | **None** |
| Checked | remove from feed; explicit flag; status; API delete; expiration; manual — **no official answer retrieved** (HelpDesk captcha) |
| Contract | **`CIAN_UNPUBLISH = BLOCKED_BY_PROVIDER_CONFIRMATION`** |
| Implementation | **Forbidden** to invent remove-from-feed = unpublish |

### STATUS

| Stage | Evidence available? |
|---|---|
| Feed received / parsed | Promo mentions import report — method bodies **ACCOUNT_ACCESS_REQUIRED** |
| Offer accepted / rejected / moderation / published / unpublished | Historical enums not live-verified this session |
| Mapping to PUBLISHING→PUBLISHED | **Cannot freeze** without live report/offer API contract |

**FSM_GAP:** moderation-only intermediate state may exist; do not add enum now.

### Photos / Contacts / Errors / Moderation

| Topic | Contract |
|---|---|
| Photos | See field table + `docs/stage-8.2.1-photo-contract.md` |
| Contacts | Phones required (archived); CRM has unstructured `ownerPhone` |
| Errors | Import errors/warnings mentioned on promo; schema **UNKNOWN** live |
| Moderation | **UNKNOWN** live |

### Implementation blockers (CIAN)

1. Live schema refresh blocked by captcha → **ACCOUNT_ACCESS_REQUIRED**
2. Unpublish official semantics missing → **PROVIDER_CONFIRMATION_REQUIRED**
3. Status API method freeze missing → **ACCOUNT_ACCESS_REQUIRED**
4. Internal P0 `floor` nullability (archived required FloorNumber)
5. Phone CountryCode/Number split incomplete
6. Commission mapping ClientFee vs AgentFee → **MAPPING_BLOCKED**
7. Public photo URLs when photos included

### Official sources / confidence

| Source | Access date | Role |
|---|---|---|
| https://promo.cian.site/api | 2026-09-21 | Transport CONFIRMED |
| Archived flatRent.xsd 2023-07-11 | 2026-09-21 | Reference field inventory only |
| Live xml_import / support / public-api | 2026-09-21 | Captcha — not used as live freeze |

**Confidence:** High for «XML is write path»; Low for implementable create/update/unpublish/status contracts.

---

## 2. AVITO

### Outcome

**BLOCKED WITH EXACT REASON** for long-term apartment Autoload implementation.

Reasons:

1. Official realty long-term («Квартиры» / «Сдам») template **not retrieved** → **ACCOUNT_ACCESS_REQUIRED**
2. Unpublish FAQ **not retrieved** → treat UNPUBLISH as **BLOCKED** until official text
3. Shared Autoload envelope + version inventory can be frozen from business page + OpenAPI mirror; category payload **cannot**

Readiness flags:  
`ACCOUNT_ACCESS_REQUIRED` + `DOCUMENTATION_BLOCKED` (realty template) + (later) `READY_AFTER_INTERNAL_GAPS`

### Transport

| Item | Value | Status |
|---|---|---|
| Mass publication | Autoload XML / CSV / Excel | **CONFIRMED** — https://www.avito.ru/business/tools/autoload |
| Realty availability | Autoload after tariff/pro plan for «Недвижимость» | **CONFIRMED** same page |
| REST Item create listing | Not present on audited Item API surface (Stage 8.2.0) | **NOT SUPPORTED** (prior audit; live catalog captcha this session) |
| Hybrid | Autoload file + Autoload API profile/reports | Version inventory below |

### AVITO_VERSION_CONTRACT

| Layer | Current / allowed | Deprecated | Evidence | Notes |
|---|---|---|---|---|
| Autoload file envelope | `Ads` `formatVersion="3"` `target="Avito.ru"`; child `Ad` | Do not mix unknown formatVersions | Stage 8.2.0 template extract (non-realty category) + product | Realty-specific tags **not frozen** |
| Supported formats | XML, CSV, Excel | — | business Autoload page | |
| Profile API | Prefer `/autoload/v2/profile` with `feeds_data` | `/autoload/v1/profile` deprecated; `upload_url` replaced by `feeds_data` since 2024-12-23 | OpenAPI mirror → developers.avito.ru | Live catalog captcha |
| Trigger upload | `POST /autoload/v1/upload` (≤1/hour) | — | OpenAPI mirror | |
| Reports | Prefer `/autoload/v4/uploads*` | v2/v3 reports: degrade from **2026-09-08**, remove **2027-03-08** | OpenAPI mirror migration notes | **Do not implement on v2/v3** |
| Item read | `/core/v1/items`, item info | — | Item OpenAPI mirror (prior) | Not create |

**Rule:** future code must not mix deprecated report fields with v4 upload models or v1 profile `upload_url` with v2 `feeds_data`.

### Account requirements

Tariff or professional plan for Realty Autoload — **CONFIRMED** (business page).  
Exact SKU / OAuth scopes for Autoload API — **ACCOUNT_ACCESS_REQUIRED**.

---

### Realty template (long-term apartment)

| Research topic | Result |
|---|---|
| Category / OperationType / LeaseType / PropertyRights | **UNKNOWN** — template pages captcha |
| title/description/price/deposit/commission/address/floor/rooms/area/photos/contacts tags | **UNKNOWN** — not confirmed as XML names |
| Required identifiers beyond shared `Id` | **UNKNOWN** |

**Do not invent tag names.**

Shared Autoload `Id` rules (from non-realty official template page retrieved Stage 8.2.0; still the only official Id text available):

| Rule | Value | Status |
|---|---|---|
| Purpose | Unique id we assign; recognizes listing across loads | CONFIRMED (shared template text) |
| Mutability | Must not change | CONFIRMED (shared) |
| Length | ≤ 100 characters | CONFIRMED (shared) |
| Charset | digits, Russian/English letters, ` , \ / ( ) [ ] - =` | CONFIRMED (shared) |
| Uniqueness | Within file; cross-load identity | CONFIRMED (shared) |
| Reuse after unpublish | **UNKNOWN** | FAQ blocked |

### Identifier contract

| ID | Role | Mutability | Persistence |
|---|---|---|---|
| Autoload `Id` | Our feed identity | Immutable | Must persist for listing lifetime on Autoload |
| Avito item id (`AvitoId` / item id) | Provider-assigned | Assigned by Avito | Store in `Publication.externalId` after success |
| `Publication.id` | Internal row id | Stable cuid | — |
| `LongTermListing.id` | Listing stable id | Stable cuid | Preferred Autoload `Id` candidate |

**Can `Publication.id` be used as Autoload `Id`?**

Charset/length of Prisma `cuid()` fit the documented `Id` rules → **YES under shared Id rules**.  
Caveat: if Publication row were ever recreated, Autoload identity would break → prefer **`LongTermListing.id`** as Autoload `Id` (still YES under charset rules; better lifecycle).  
Derived form `rental-os-lt-{id}` — optional; **not required** by docs; **not implemented**.

### CREATE

| | |
|---|---|
| transport | Autoload file containing new `Ad`/`row` with new `Id` |
| identifier | Autoload `Id` (ours) |
| success evidence | Autoload v4 upload item success + `avito_status=active` (OpenAPI mirror enums) and/or Item API read |
| failure evidence | Autoload report error / rejected / blocked |
| realty payload schema | **BLOCKED** — template missing |

### UPDATE

| | |
|---|---|
| transport | Same Autoload file; same `Id`; changed fields |
| matching semantics | Stable `Id` (CONFIRMED shared); AvitoId semantics **UNKNOWN** without FAQ/template |
| success / failure | Same as reports |
| field mutability | **UNKNOWN** for realty |

### UNPUBLISH

| | |
|---|---|
| transport | **BLOCKED** — official FAQ/template text not retrieved |
| exact official semantics | **UNKNOWN** |
| success / failure | Cannot freeze |

**AVITO_UNPUBLISH = BLOCKED** until account/docs access.

### STATUS → FSM (no FSM change)

| Provider signal | PublicationStatus | Note |
|---|---|---|
| Feed URL registered / upload started | PUBLISHING | |
| Upload processing | PUBLISHING | |
| Item active in report | PUBLISHED | only on evidence |
| Validation error | ERROR | |
| rejected / blocked | ERROR | |
| archived / removed (enums in OpenAPI) | UNPUBLISHED **only if** unpublish path confirmed | else FSM gap |
| Moderation queue without active | **FSM_GAP** | no MODERATION_PENDING in enum |

### Photos / Contacts / Errors / Moderation

| Topic | Status |
|---|---|
| Photos | Realty rules **UNKNOWN**; see photo-contract |
| Contacts | Tag names **UNKNOWN** |
| Errors | Autoload reports (v4) |
| Moderation | Item statuses include rejected/blocked (OpenAPI mirror) |

### Implementation blockers (Avito)

1. Realty long-term Autoload template — **ACCOUNT_ACCESS_REQUIRED** / **DOCUMENTATION_BLOCKED**
2. Unpublish official semantics — **BLOCKED**
3. Autoload OAuth scopes vs STR — **ACCOUNT_ACCESS_REQUIRED**
4. Internal photo public URL (when emitting images)
5. Live developers catalog verification

### Confidence

Medium for Autoload transport + version deprecation map; **Low** for apartment LT payload.

---

## 3. DOMCLICK

### Outcome

**BLOCKED WITH EXACT REASON**

`DOMCLICK IMPLEMENTATION = BLOCKED`  
`DOCUMENTATION_BLOCKED` + `ACCOUNT_ACCESS_REQUIRED`

Provider-specific research **stopped** after access audit (per Stage TZ §15).

### Domclick access audit

| Question | Result |
|---|---|
| Is technical XML documentation available after Domclick PRO authentication? | **UNKNOWN** without authenticated session. Public validator/help/PRO/feeds return Qrator **401**. Classification: **PARTNER_ACCOUNT_REQUIRED** (and/or **SUPPORT_REQUEST_REQUIRED** to obtain schema). |
| Partner feed for secondary long-term residential rental? | **NOT confirmed** by public official schema this session. Wallet FAQ confirms listings can be placed «через XML-файл (фид)» generally — **not** a LT secondary schema. |
| How can a partner obtain the specification? | Official path not readable through WAF. Record: **SUPPORT_REQUEST_REQUIRED** + **PARTNER_ACCOUNT_REQUIRED**. |
| Access enum | **PARTNER_ACCOUNT_REQUIRED** / **SUPPORT_REQUEST_REQUIRED** / public LT schema **NOT_AVAILABLE** in this session |

Do **not** reconstruct XML from third-party CRM examples.

### Contract sections

| Area | Status |
|---|---|
| CREATE / UPDATE / UNPUBLISH / STATUS | **UNKNOWN** — schema not obtained |
| Identifiers / Photos / Contacts / Auth / Feed delivery | **UNKNOWN** |
| Transport concept | XML feed exists as product concept — **CONFIRMED** (wallet.domclick.ru) |
| Long-term rental schema | **NOT CONFIRMED** |

### Confidence

Low. Implementation: **DOCUMENTATION_BLOCKED**.

---

## 4. Cross-provider summary

| Provider | Contract freeze | Overall Stage 8.2.1 result |
|---|---|---|
| CIAN | Partial reference from archived XSD; unpublish/status live blocked | **BLOCKED WITH EXACT REASON** |
| AVITO | Version contract frozen; realty payload blocked | **BLOCKED WITH EXACT REASON** |
| DOMCLICK | Access audit only | **BLOCKED WITH EXACT REASON** |

**No provider is IMPLEMENTATION CONTRACT READY.**
