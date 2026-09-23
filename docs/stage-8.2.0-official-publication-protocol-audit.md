# Stage 8.2.0 — Official Publication Protocol Audit

**Project:** rental-os  
**Stage:** 8.2.0  
**Type:** RESEARCH / ARCHITECTURE AUDIT ONLY  
**Access date:** 2026-09-21  
**Scope:** long-term residential rental publication for Avito / CIAN / Domclick  

**Hard constraints of this stage (observed):**

- No Prisma / migration changes
- No provider adapters, serializers, feed endpoints, publish/unpublish/sync APIs
- No credentials, no FSM changes, no short-term Avito changes
- No implementation of Stage 8.2

---

## 0. Evidence policy

### Confidence labels

| Label | Meaning |
|---|---|
| **CONFIRMED** | Stated by an official primary source retrieved in this audit |
| **PARTIALLY CONFIRMED** | Official source supports part of the claim; details incomplete, blocked, or only in archived snapshot |
| **NOT CONFIRMED** | Claim appears in secondary sources but not proven by official docs in this session |
| **NOT SUPPORTED** | Official surface exists and does **not** expose the capability |
| **UNKNOWN / REQUIRES PROVIDER ACCESS** | Cannot answer without account, private docs, or support |

### Source freshness classes

| Status | Meaning |
|---|---|
| CURRENT | Live official URL readable in this session |
| CURRENT (CAPTCHA / WAF) | Official URL exists; body blocked (captcha / Qrator / IP gate) |
| ARCHIVED SNAPSHOT | Official content recovered via Wayback Machine; may lag live |
| MIRROR OF OFFICIAL OPENAPI | Third-party raw OpenAPI that quotes `developers.avito.ru` / `api.avito.ru`; treat as PARTIAL until live catalog is readable |
| LEGACY / DEPRECATED | Explicitly marked deprecated in official/mirrored OpenAPI |

Secondary sources (Habr, CRM blogs, GitHub mirrors, SEO guides) were used **only for discovery**. They never alone justify **CONFIRMED**.

### Access limitations this session

| Provider area | Blocker |
|---|---|
| `avito.ru/autoload/documentation*` | IP / captcha gate |
| `developers.avito.ru/api-catalog/*` | IP / captcha gate |
| Live `cian.ru/xml_import/doc/` and live `flatRent.xsd` | Captcha / anti-bot HTML |
| `support.cian.ru` XML HelpDesk | Captcha |
| `domclick.ru/validation`, `help.domclick.ru`, `my.domclick.ru/feeds` | Qrator WAF (401 empty challenge) |
| Internet Archive (partial) | Temporarily offline for some CDX queries; one CIAN snapshot succeeded |

Where a live official page was blocked, the audit records **PARTIALLY CONFIRMED** or **UNKNOWN** rather than inventing endpoints.

---

## 1. Current project architecture (confirmed in repo)

### 1.1 Long-term vs short-term

```
SHORT-TERM
Property → ChannelListing → existing external listing → calendar / booking sync

LONG-TERM
Property → LongTermListing → Publication → future provider publication mechanism
```

Confirmed in code/docs:

- `Publication` model exists (`prisma/schema.prisma`), unique per `(longTermListingId, salesChannelId)`
- Channels intended for long-term publication: `AVITO`, `CIAN`, `DOMCLICK`
- `ChannelListing` remains short-term only
- Provider abstraction stub: `lib/publications/provider.ts` (`API | FEED`), **no real adapters**
- FSM: `lib/publications/state-machine.ts` — **not modified in this stage**
- Snapshot of published payload: **not stored** (Stage 8.1 decision)

### 1.2 Relevant CRM fields (inventory only)

| Entity | Relevant fields |
|---|---|
| `Property` | `type`, `address`, `city`, `district`, `area`, `rooms`, `bedrooms`, `bathrooms`, `floor`, `totalFloors`, `description`, `ownerPhone`, `ownerName`, `monthlyPrice` (not SoT for LT) |
| `PropertyPhoto` | `url`, `caption`, `sortOrder` — no mime/size/checksum/public CDN guarantee |
| `LongTermListing` | `monthlyPrice`, `deposit`, `commission`, `minimumRentalPeriod`, `marketingTitle`, `description`, rental blocks, `status` |
| `LongTermListingPhoto` | `photoId`, `sortOrder`, `included` |
| `Publication` | `status`, `externalId`, `externalStatus`, `lastSyncAt`, `lastSuccessAt`, `lastError*` |
| `SalesChannel` | identity `AVITO` / `CIAN` / `DOMCLICK` |

**Do not use** `ChannelListing.externalId` for long-term publication IDs.

---

## 2. Source register

### Avito

| # | Title | Official URL | Access date | Doc date / version | Status |
|---|---|---|---|---|---|
| A1 | Автозагрузка (бизнес-лендинг) | https://www.avito.ru/business/tools/autoload | 2026-09-21 | © 2007–2026 (page) | CURRENT (partial via search/snippet; full page often IP-gated) |
| A2 | Автозагрузка — правила и шаблоны (общий каркас файла) | https://www.avito.ru/autoload/documentation/templates | 2026-09-21 | © 2007–2026 | CURRENT (CAPTCHA); one category template JSON extract retrieved |
| A3 | Пример шаблонной страницы параметров (Id / Ads / formatVersion) | https://www.avito.ru/autoload/documentation/templates/67097?fileFormat=xml | 2026-09-21 | live | CURRENT — **category = Ноутбуки**, used only for **shared** Autoload file rules |
| A4 | Autoload OpenAPI (official catalog target) | https://developers.avito.ru/api-catalog/autoload/documentation | 2026-09-21 | Autoload API v1–v4; reports v2/v3 deprecated → v4 | CURRENT (CAPTCHA). Content audited via mirror A5 |
| A5 | Autoload OpenAPI YAML (mirror of official) | https://raw.githubusercontent.com/api-evangelist/avito/refs/heads/main/openapi/avito-autoload-api-openapi.yml | 2026-09-21 | OpenAPI 3.0; `servers: https://api.avito.ru/` | MIRROR OF OFFICIAL OPENAPI |
| A6 | Item OpenAPI YAML (mirror) | same repo `avito-item-api-openapi.yml` | 2026-09-21 | Item read / VAS / stats | MIRROR OF OFFICIAL OPENAPI |
| A7 | Realty Autoload format anchor referenced by Autoload API | https://autoload.avito.ru/format/realty/#Id | 2026-09-21 | — | CURRENT (CAPTCHA on body) |
| A8 | Public API terms | https://www.avito.ru/legal/pro_tools/public-api | 2026-09-21 | linked from OpenAPI | CURRENT (fetch timeout this session) |
| A9 | Existing rental-os short-term adapter | `lib/integrations/adapters/avito.ts` | 2026-09-21 | code | CURRENT — STR only; **not** LT create |

### CIAN

| # | Title | Official URL | Access date | Doc date / version | Status |
|---|---|---|---|---|---|
| C1 | Циан API promo / FAQ | https://promo.cian.site/api | 2026-09-21 | live | CURRENT |
| C2 | Public API cabinet | https://public-api.cian.ru/ | 2026-09-21 | live shell | CURRENT (CAPTCHA / thin HTML); method bodies not fully readable |
| C3 | XML import technical docs | https://www.cian.ru/xml_import/doc/ | 2026-09-21 | live | CURRENT (CAPTCHA) |
| C4 | Archived XML docs | Wayback `20230711204141` of C3 | 2026-09-21 | snapshot **2023-07-11** | ARCHIVED SNAPSHOT of official page |
| C5 | Archived `flatRent.xsd` | Wayback `.../xml_import/schema/flatRent.xsd` (same timestamp) | 2026-09-21 | `feed_version` fixed **2** | ARCHIVED SNAPSHOT |
| C6 | Live XSD URL | https://www.cian.ru/xml_import/schema/flatRent.xsd | 2026-09-21 | — | CURRENT (CAPTCHA HTML, not XSD bytes) |

### Domclick

| # | Title | Official URL | Access date | Doc date / version | Status |
|---|---|---|---|---|---|
| D1 | Кошелёк — FAQ (mentions XML feed listings) | https://wallet.domclick.ru/ | 2026-09-21 | live | CURRENT |
| D2 | Validation / requirements | https://domclick.ru/validation | 2026-09-21 | — | CURRENT (WAF / 401 challenge) |
| D3 | Help Center | https://help.domclick.ru/ | 2026-09-21 | — | CURRENT (WAF) |
| D4 | Promo “разместить объявление” | https://promo.domclick.ru/razmestit-obyavlenie-o-prodazhe-nedvijimosty | 2026-09-21 | live | CURRENT — manual listing UX; not partner XML schema |
| D5 | Chats / Stats public API hosts | `public-api.domclick.ru/chats`, `/stats` | 2026-09-21 | — | CURRENT hosts; **not** listing publication APIs |

---

## 3. AVITO — long-term rental audit

### 3.1 Publication transport

| Question | Status | Answer |
|---|---|---|
| Transport for mass listing publication | **CONFIRMED** (mechanism) | **Autoload** via XML / CSV / Excel file |
| REST API create long-term listing | **NOT SUPPORTED** in Item API surface audited | Item OpenAPI exposes **read** items + VAS/stats, not create listing |
| Hybrid | **PARTIALLY CONFIRMED** | Autoload file + Autoload REST for profile/upload/reports; Item REST for post-publish read |

**Mechanism (CONFIRMED / PARTIAL):**

1. Seller prepares Autoload file (XML/CSV/XLSX).
2. File is registered as feed URL(s) in Autoload profile (`feeds_data`) and/or uploaded; schedule controls polling (**A5**).
3. Avito processes feed; reports available via Autoload API v4 uploads (**A5**).
4. Optional: `POST /autoload/v1/upload` triggers one fetch of the configured URL (max 1/hour per OpenAPI text) (**A5**).

**Official evidence:** A1 (XML/CSV/Excel + schedule), A3 (Ads/Ad/formatVersion/UTF-8), A5 (feeds_data, schedule, upload, reports).

**Not confirmed this session:** exact Autoload template node for **«Квартиры / Сдам»** (long-term residential). Realty template pages were captcha-blocked (**A7**). Category-specific field names for rent must be taken from the live realty template before Stage 8.2 implementation — **do not invent**.

### 3.2 CREATE

| Aspect | Status | Evidence |
|---|---|---|
| Create via Autoload new `Ad` / row with new `Id` | **PARTIALLY CONFIRMED** | Autoload is the publication tool (A1); `Id` identifies listing across loads (A3). Exact «new Id ⇒ create» wording for realty rent template not re-read live |
| Create via REST `POST /listing` | **NOT SUPPORTED** (Item API) | No create operation in Item OpenAPI (A6) |
| Request schema (realty rent) | **NOT CONFIRMED** | Need live category template |
| Response / external ID | **PARTIALLY CONFIRMED** | Autoload reports expose Avito item id mapping (`/autoload/v2/items/avito_ids`, v4 upload items with `avito_status`) (A5) |

### 3.3 UPDATE

| Aspect | Status | Notes |
|---|---|---|
| Update via same Autoload `Id` | **PARTIALLY CONFIRMED** | A3: Id must not change across loads or Avito treats as different listing / risk of blocks |
| `AvitoId` usage | **PARTIALLY CONFIRMED** | Referenced in Autoload ecosystem / FAQ historically; live FAQ blocked — do not hardcode without template |
| Field-level updatability (price, description, photos, deposit, …) | **UNKNOWN** for realty rent | Requires category template |
| Immutable fields | **PARTIALLY CONFIRMED** | **`Id` must stay stable** (A3). Others unknown for realty |

### 3.4 UNPUBLISH

| Mechanism | Status | Notes |
|---|---|---|
| Remove listing from Autoload file / feed | **PARTIALLY CONFIRMED** | Widely described in Autoload product materials; **live FAQ not retrieved** this session → not elevated to CONFIRMED |
| Explicit REST delete/unpublish for LT | **NOT CONFIRMED** | Not found as LT write API |
| Archive vs delete forever | **PARTIALLY CONFIRMED** | Autoload report `avito_status` includes `archived`, `removed` (A5). Mapping «remove from feed → which status» needs account verification |
| Distinction DELETE / UNPUBLISH / ARCHIVE / REMOVE FROM FEED | **UNKNOWN / REQUIRES PROVIDER ACCESS** | Product UI vs Autoload semantics need official FAQ + account test |

**Do not implement unpublish until FAQ/template wording is captured from a non-captcha session or partner account.**

### 3.5 STATUS

| Mechanism | Status | Notes |
|---|---|---|
| Autoload upload reports (v4) | **CONFIRMED** (API exists) | `GET /autoload/v4/uploads`, `.../current`, `.../last_successful`, `.../items` (A5) |
| Legacy report endpoints v2/v3 | **DEPRECATED** | Partial degradation from **2026-09-08**, removal **2027-03-08** (A5) |
| Item list/status read | **CONFIRMED** (read) | `GET /core/v1/items`, `GET /core/v1/accounts/{user_id}/items/{item_id}/` (A6) |
| Webhook listing publish | **UNKNOWN** | Not evidenced for LT publication |
| Fake success forbidden | Architecture constraint | `PUBLISHING → PUBLISHED` only after report/item confirmation |

### 3.6 PHOTOS

| Question | Status | Notes |
|---|---|---|
| Remote image URLs | **PARTIALLY CONFIRMED** | Autoload product uses image URLs / ZIP patterns in general docs; exact realty tags (`Image` / `ImageUrls` / …) **NOT CONFIRMED** without template |
| HTTPS required | **UNKNOWN** | Profile `upload_url`/`feeds_data` must be http(s) (A5); image URL scheme for realty TBD |
| Max photos / size / dimensions / formats | **NOT CONFIRMED** (realty) | Need template |
| URL cache / binary replace | **UNKNOWN** | |

### 3.7 AUTHENTICATION

| Concern | Status | Notes |
|---|---|---|
| Existing STR OAuth (`short_term_rent:*`) | **CONFIRMED** in repo | Must **not** be assumed sufficient for Autoload publication |
| Autoload API OAuth | **PARTIALLY CONFIRMED** | Same `api.avito.ru` + OAuth schemes in Autoload OpenAPI (A5); exact scopes for Autoload **not fully enumerated** this session |
| Autoload LK: tariff / feed URL / schedule | **CONFIRMED** (product) | Realty Autoload available after tariff/pro plan (A1) |
| Equivalence STR OAuth ≡ Autoload rights | **NOT CONFIRMED** | Treat as separate capability until proven |

### 3.8 External identifiers

| ID | Role | Status |
|---|---|---|
| Autoload `Id` | Our stable feed identifier | **CONFIRMED** rules (A3): ≤100 chars; digits/letters/` , \ / ( ) [ ] - =`; **immutable** |
| Avito item id | Provider-assigned | **CONFIRMED** as concept via Item + Autoload mapping APIs |
| `Publication.id` as Autoload `Id` | Likely safe length/charset (cuid) | **PARTIALLY CONFIRMED** — charset OK; prefer stable listing-scoped id (`LongTermListing.id` or Publication.id) and **never rotate** |
| `Publication.externalId` | Store Avito item id after success | Architecture recommendation |

### 3.9 Account requirements

| Requirement | Status |
|---|---|
| Business / tariff for Realty Autoload | **CONFIRMED** (A1) |
| Developer app + OAuth for Autoload API | **PARTIALLY CONFIRMED** (A5 terms link) |
| Region / category availability long-term flat rent | **UNKNOWN / ACCOUNT-DEPENDENT** |

### 3.10 Avito ADR (recommendation for Stage 8.2+)

| Item | Value |
|---|---|
| Recommended transport | **Autoload feed** (XML preferred for CRM generation) + Autoload API for profile/reports; Item API read-only |
| Evidence | A1, A3, A5, A6 |
| Confidence | **Medium** for transport; **Low** for realty field map |
| Implementation readiness | **READY WITH ACCOUNT ACCESS** + **BLOCKED BY DOCUMENTATION** (realty template) + **BLOCKED BY INTERNAL DATA** (public photo URLs) |
| GO / NO-GO for safe Stage 8.2 | **PARTIAL** — architecture can start feed scaffolding only after live realty template is captured; do not invent category fields |

---

## 4. CIAN — long-term flat rent audit

### 4.1 Publication transport

| Question | Status | Answer |
|---|---|---|
| Automatic listing export | **CONFIRMED** | **XML file** — «Автоматическая выгрузка объявлений происходит при помощи XML-файла.» (**C1**) |
| REST create/update listing | **NOT SUPPORTED** as publication API | Promo FAQ denies transferring listings via API (**C1**) |
| Cabinet API role | **PARTIALLY CONFIRMED** | Read / reports / chats / finance — not write listing body |

**Working hypothesis validated:** `Category = flatRent`, transport = XML — **CONFIRMED** in archived official docs + XSD (**C4**, **C5**). Live page/XSD captcha-blocked (**C3**, **C6**) → mark field details as **PARTIALLY CONFIRMED** pending live re-fetch.

### 4.2 XML structure

| Element | Status | Notes |
|---|---|---|
| Root `feed` | **CONFIRMED** (archived XSD) | |
| `feed_version` fixed `2` | **CONFIRMED** (archived XSD) | |
| `object` unbounded | **CONFIRMED** | |
| `Category` = `flatRent` | **CONFIRMED** | |
| `ExternalId` required string | **CONFIRMED** | |
| Official XSD URL | **PARTIALLY CONFIRMED** | Path `https://www.cian.ru/xml_import/schema/flatRent.xsd` linked from archived docs; live fetch returned captcha HTML |

**Do not copy XSD into the repo on Stage 8.2.0** (constraint). Reference URL only.

### 4.3 Required fields (`flatRent`) — schema vs product

Important: **XSD `minOccurs="1"` ≠ always product-required**, but it is the strongest public signal available.

#### Schema-required (archived XSD, 2023-07-11) — PARTIALLY CONFIRMED vs live

| CIAN field | XSD required? | Type / notes | Our source | Transform | Confirmed by |
|---|---|---|---|---|---|
| `ExternalId` | yes | string | `LongTermListing.id` or `Publication.id` | none | C5 |
| `Category` | fixed `flatRent` | string | constant | map Property type | C5 |
| `Description` | yes | string | marketing blocks | concatenate; strip `&`/HTML (docs historically) | C5 + C4 |
| `Address` | yes | string | Property address | Yandex-style formatting (docs) | C5 |
| `FlatRoomsCount` | yes | int | Property.rooms | studio→special value historically `9` — **re-verify live** | C5 |
| `TotalArea` | yes | double | Property.area | | C5 |
| `FloorNumber` | yes | int | Property.floor | **MISSING if null** | C5 |
| `BedsCount` | yes | int | Property.bedrooms? | may not equal beds | C5 |
| `Phones` / `PhoneSchema` | yes | CountryCode + Number | Property.ownerPhone | split E.164 | C5 |
| `Building` | yes (element) | children mostly optional | Property.totalFloors → `FloorsCount` optional in XSD | | C5 |
| `BargainTerms` / `Price` | yes | double | LongTermListing.monthlyPrice | | C5 |
| `Photos` | **no** (minOccurs 0) | PhotoSchema if present | LongTermListingPhoto | public FullUrl | C5 |
| `Deposit` | no | under BargainTerms | LongTermListing.deposit | | C5 |
| `ClientFee` / `AgentFee` | no | % | LongTermListing.commission | semantic mismatch risk | C5 |
| `LeaseTermType` | no | `fewMonths` \| `longTerm` | minimumRentalPeriod? | mapping unclear | C5 |
| `Coordinates` | no | Lat/Lng | **MISSING INTERNAL** | | C5 |
| `PublishTerms` | no | promotion packages | n/a | account packages | C5 |
| `Title` | (docs historically conditional) | Top/Premium only | marketingTitle | | C4 historical |

### 4.4 CREATE / UPDATE

| Question | Status | Notes |
|---|---|---|
| New `ExternalId` creates listing | **PARTIALLY CONFIRMED** | ExternalId is mandatory unique identity of object in feed; create semantics standard for feed importers but **not re-quoted verbatim** from live FAQ this session |
| Same `ExternalId` updates | **PARTIALLY CONFIRMED** | Same |
| Feed polling frequency | **UNKNOWN** | Not found as official numeric SLA in retrieved pages |
| Moderation delay | **UNKNOWN** | |

### 4.5 UNPUBLISH

| Question | Status |
|---|---|
| Object removed from XML feed | **UNKNOWN / REQUIRES PROVIDER CONFIRMATION** |
| Explicit delete tag in XML | **NOT CONFIRMED** in archived schema |
| API delete listing | **NOT SUPPORTED** as publication write |

**Stage rule:** treat CIAN unpublish as **REQUIRES PROVIDER CONFIRMATION** before coding `UNPUBLISHING → UNPUBLISHED`.

### 4.6 STATUS / REPORTS

| Mechanism | Status | Notes |
|---|---|---|
| XML import reports via cabinet API | **PARTIALLY CONFIRMED** | Promo: «отчет по выгрузке» (**C1**). Exact path names (`get-order`, etc.) historically documented; **not re-validated** against live OpenAPI this session |
| Offer list statuses | **PARTIALLY CONFIRMED** | Historical: `published`, `inactive`, `refusedByModerator`, … |
| Webhook for listing publish | **NOT SUPPORTED** (as publish webhook) | Chats/system messages exist separately |
| Mapping to `Publication.externalId` | offerId from import report | Architecture recommendation |

### 4.7 PHOTOS

| Question | Status | Notes |
|---|---|---|
| Remote `FullUrl` | **CONFIRMED** (archived XSD/docs) | |
| `IsDefault` | **CONFIRMED** | |
| Max count / formats / size / dimensions | **PARTIALLY CONFIRMED** | Historical docs (Stage 8.0 / archived page) cite max 50, JPG/PNG/GIF, ≥200px, ≤10MB — **live re-verify required** |
| Same URL, new binary | **PARTIALLY CONFIRMED** historically as «needs new URL» | Re-verify live; treat as **risk** for CRM photo strategy |

### 4.8 AUTHENTICATION

| Item | Status |
|---|---|
| ACCESS KEY Bearer for cabinet API | **PARTIALLY CONFIRMED** (promo: key in LK) |
| Feed URL registration | **PARTIALLY CONFIRMED** (import onboarding historically via import@cian.ru / LK) |
| XML itself contains secrets | Must not |

### 4.9 External ID strategy

| ID | Recommendation | Status |
|---|---|---|
| Feed `ExternalId` | Prefer immutable `LongTermListing.id` (or dedicated stable id) | **PARTIALLY CONFIRMED** fit |
| Provider `offerId` | Store in `Publication.externalId` after confirmed import | **PARTIALLY CONFIRMED** |
| Can `Publication.id` be ExternalId? | Yes if never rotated and unique per account feed | Acceptable |

### 4.10 Account requirements

| Item | Status |
|---|---|
| Agency / realtor tariff for XML + API | **PARTIALLY CONFIRMED** (C1 footnote) |
| Contract / support activation for feed | **UNKNOWN / REQUIRES PROVIDER ACCESS** |

### 4.11 CIAN ADR

| Item | Value |
|---|---|
| Recommended transport | **XML feed write** + **cabinet API read/reports** |
| Evidence | C1, C4, C5 |
| Confidence | **High** for transport; **Medium** for field map (archived XSD); **Low** for unpublish |
| Implementation readiness | **READY WITH ACCOUNT ACCESS** + **BLOCKED BY INTERNAL DATA** (coords, phones formatting, public photos, floor nullability) + unpublish gap |
| GO / NO-GO | **PARTIAL** — safest of three for feed generation design; unpublish & live XSD refresh required before production publish |

---

## 5. DOMCLICK — audit

### 5.1 Do not confuse APIs

| Surface | Publication? | Status |
|---|---|---|
| Partner XML feed | Candidate publication mechanism | **PARTIALLY CONFIRMED** concept |
| Statistics API | No | **NOT SUPPORTED** as publication |
| Chats API | No | **NOT SUPPORTED** as publication |
| Wallet / promotion tags | Promotion of **already placed** listings | **CONFIRMED** (D1) — not create |

### 5.2 Publication transport

| Question | Status |
|---|---|
| XML feed / URL exists as product concept | **CONFIRMED** — D1: listings «Размещённые вручную и через XML-файл (фид)» can be promoted |
| Public long-term secondary rental XML schema | **NOT CONFIRMED** |
| New-build / JK XML requirements | **NOT CONFIRMED** for secondary LT rent; must **not** reuse |
| REST create listing API | **NOT CONFIRMED** / treat as **NOT SUPPORTED** until official methods appear |
| Manual only for some account types | **UNKNOWN / ACCOUNT-DEPENDENT** |

**Resulting split (required by TZ):**

- Transport (XML feed concept) = **CONFIRMED**
- Long-term rental schema = **NOT CONFIRMED**

### 5.3 Operations

| Operation | Status |
|---|---|
| CREATE | **PARTIALLY CONFIRMED** (via feed conceptually) / schema **NOT CONFIRMED** |
| UPDATE | **UNKNOWN** |
| UNPUBLISH | **UNKNOWN** |
| STATUS | **UNKNOWN** (stats ≠ publication status) |
| Photos rules | **UNKNOWN** |

### 5.4 Domclick ADR

| Item | Value |
|---|---|
| Recommended transport | **Do not implement serializer** until official LT rental schema is obtained |
| Evidence | D1 confirms feed concept; D2 blocked |
| Confidence | **Low** for implementation |
| Implementation readiness | **BLOCKED BY DOCUMENTATION** + **BLOCKED BY CREDENTIALS** (partner/PRO account) |
| GO / NO-GO | **NO** |

---

## 6. Data mapping (summary)

See detailed matrix: `docs/stage-8.2.0-provider-field-matrix.md`.

Normalized path (architecture only):

```
LongTermListing + Property (+ selected photos)
        ↓
Normalized publication DTO (future, not coded)
        ↓
Provider-specific serializer (future)
```

---

## 7. Gap analysis vs current database

### P0 — blocks publication

| Gap | Providers | Notes |
|---|---|---|
| Public absolute HTTPS photo URLs reachable by provider crawlers | Avito, CIAN, Domclick | `PropertyPhoto.url` may be relative/`/uploads` — **PUBLICATION BLOCKER** |
| Stable photo URL versioning (CIAN risk) | CIAN | Changing bytes behind same URL historically ignored |
| Live Avito realty Autoload template for «Сдам» | Avito | Cannot serialize correctly |
| Official Domclick LT rent schema | Domclick | Cannot serialize |
| CIAN unpublish semantics | CIAN | Cannot safely drive FSM unpublish |

### P1 — publishable but incomplete / risky

| Gap | Providers |
|---|---|
| `Property.floor` nullable vs CIAN `FloorNumber` required | CIAN |
| No lat/lng | CIAN (optional but useful) |
| Phone structured CountryCode/Number | CIAN |
| `BedsCount` vs bedrooms semantics | CIAN |
| Commission meaning (CRM % vs ClientFee/AgentFee) | CIAN |
| Deposit/commission Autoload tags | Avito |
| Building material / year | CIAN enrichment |
| Amenity booleans | CIAN |

### P2 — enrichment

| Gap | Providers |
|---|---|
| Cadastral number | CIAN / Domclick promo features |
| JK / metro / highway | CIAN |
| LeaseTermType / PrepayMonths | CIAN |
| Title length rules (premium) | CIAN |
| Special offer ↔ Bargain* | CIAN |

**Prisma must not be changed on this stage** — gaps are documented only.

---

## 8. Photo infrastructure gap

Current chain:

```
PropertyPhoto → LongTermListingPhoto (included/sortOrder) → LongTermListing → Publication
```

| Need | Current | Verdict |
|---|---|---|
| Selection + ordering | yes | OK |
| Public HTTPS URL | no guarantee | **BLOCKER** |
| Stable URL | unknown | risk |
| Provider-accessible (no auth cookie) | unknown | risk |
| Dimensions / mime / checksum | not stored | P1/P2 |
| Main photo flag | first included only | map to CIAN `IsDefault` later |
| Versioned URL on replace | no | CIAN risk |

Storage/CDN **not** implemented on 8.2.0.

---

## 9. External ID strategy (decision draft)

| Provider | Our stable feed id | Provider-assigned id → `Publication.externalId` |
|---|---|---|
| Avito | Autoload `Id` = `LongTermListing.id` (preferred) or `Publication.id` | Avito item id |
| CIAN | `ExternalId` = same stable id | `offerId` |
| Domclick | **UNKNOWN** until schema | **UNKNOWN** |

**Can `Publication.id` be provider ExternalId?**  
Technically yes for Avito charset/length and CIAN string ExternalId, **if immutable**. Prefer `LongTermListing.id` so republish after Publication row recreation (if ever) stays stable — open design choice for 8.2.

Never reuse `ChannelListing.externalId`.

---

## 10. Publication FSM compatibility

Current statuses unchanged:

`NOT_PUBLISHED → PUBLISHING → PUBLISHED → UPDATE_PENDING → … → UNPUBLISHING → UNPUBLISHED` + `ERROR`

| Provider signal | Map to | Gap? |
|---|---|---|
| Feed generated / URL live | stay `PUBLISHING` | no |
| Autoload upload `processing` | `PUBLISHING` | no |
| Autoload item success + `avito_status=active` | `PUBLISHED` | no |
| Autoload validation error | `ERROR` | no |
| `rejected` / moderation | `ERROR` + `externalStatus` | optional future `MODERATION_PENDING` — **FSM GAP** (do not add now) |
| CIAN import errors[] | `ERROR` | no |
| CIAN `refusedByModerator` | `ERROR` | FSM GAP same |
| Remove from Avito feed → archived | `UNPUBLISHED` after confirm | need confirm |
| Remove from CIAN feed | ??? | **FSM GAP / provider confirmation** |
| Domclick | n/a | blocked |

**Recommendation:** keep enum; store raw provider state in `externalStatus`; consider future `MODERATION_PENDING` only if product needs it.

---

## 11. Feed architecture

### Delivery options

| Option | Description |
|---|---|
| A | `GET /feeds/{provider}/long-term.xml` — provider polls |
| B | Generate file → upload / register |

| Provider | Official mechanism | Choice |
|---|---|---|
| Avito | Feed URL(s) in Autoload profile (`feeds_data`) + schedule; also manual upload; API `POST /autoload/v1/upload` | **A primary**, B optional |
| CIAN | Permanent feed URL registered with import | **A** |
| Domclick | URL registration in partner LK (secondary sources); official schema unread | **A presumed**, **NOT CONFIRMED** for LT |

### Feed scope

| Scope | Avito | CIAN | Domclick |
|---|---|---|---|
| One feed per Publication | Unusual; not required | Unusual | UNKNOWN |
| One feed per provider with all active listings | **Likely** | **Likely** | UNKNOWN |
| One feed per account | Matches Autoload profile | Matches import account | UNKNOWN |

**Recommendation:** one feed document per provider per rental-os account containing all listings that should be active on that provider.

---

## 12. Update detection (no snapshot)

Problem: LongTermListing changes → when to `UPDATE_PENDING`?

| Approach | Pros | Cons |
|---|---|---|
| `updatedAt` | simple | false positives (unrelated fields) |
| Payload / serializer hash | detects serializable changes | needs stable canonicalization |
| Version counter | explicit | requires writers to bump |
| Snapshot | Stage 8.1 rejected | |

**Recommendation for Stage 8.2+:** store `Publication.lastSerializedHash` (or equivalent metadata **only when implementing**) over canonical provider payload; compare on listing save. **Do not implement on 8.2.0.**

---

## 13. Provider failure model (distinguishability)

| Class | Avito | CIAN | Domclick |
|---|---|---|---|
| SERIALIZATION_ERROR | local | local | local |
| DELIVERY_ERROR | upload API / feed fetch | feed fetch by CIAN | UNKNOWN |
| FEED_FETCH_ERROR | provider cannot GET URL | same | UNKNOWN |
| VALIDATION_ERROR | Autoload report item errors | import `errors[]` | UNKNOWN |
| MODERATION_ERROR | `rejected` status | `refusedByModerator` | UNKNOWN |
| AUTH_ERROR | 401/403 Autoload/Item | 401 API | UNKNOWN |
| RATE_LIMIT | 429 Item/Autoload | ≤10 rps historically | UNKNOWN |
| PROVIDER_ERROR | 5xx | 5xx | UNKNOWN |
| UNKNOWN | fallback | fallback | default |

No enum added in code.

---

## 14. Security audit (future secrets — do not add to `.env` now)

| Secret | Exists? | Obtain | Notes |
|---|---|---|---|
| Avito client_id/secret + OAuth tokens | yes (STR) | developers portal | May need extra Autoload scopes |
| Avito Autoload feed URL | not secret, but sensitive | LK / Autoload API | Prefer obscure URL; auth support **UNKNOWN** |
| CIAN ACCESS KEY | future | LK / email | Encrypt like IntegrationConnection |
| Domclick publication credentials | **UNKNOWN** | partner account | Stats/chats token ≠ publish |
| Feed Basic Auth / signed URL | **UNKNOWN** per provider | — | Do not invent |

### Feed security

| Question | Avito | CIAN | Domclick |
|---|---|---|---|
| Private authenticated feed URL | **UNKNOWN** officially this session | **UNKNOWN** | **UNKNOWN** |
| Public HTTPS URL | **PARTIALLY CONFIRMED** expected | **PARTIALLY CONFIRMED** | presumed |
| IP allowlist | historically mentioned in Autoload FAQ — **NOT re-confirmed live** | UNKNOWN | UNKNOWN |

---

## 15. Final provider matrix

| Capability | Avito | CIAN | Domclick |
|---|---|---|---|
| Long-term rental publication | PARTIAL | PARTIAL | PARTIAL (concept) |
| REST create | NOT SUPPORTED | NOT SUPPORTED | NOT CONFIRMED |
| XML/feed | CONFIRMED | CONFIRMED | CONFIRMED (concept) / schema NOT CONFIRMED |
| Create | PARTIAL | PARTIAL | PARTIAL |
| Update | PARTIAL | PARTIAL | UNKNOWN |
| Unpublish | PARTIAL / UNKNOWN | REQUIRES PROVIDER CONFIRMATION | UNKNOWN |
| Status | CONFIRMED (reports/items) | PARTIAL (reports API) | UNKNOWN |
| Moderation status | PARTIAL | PARTIAL | UNKNOWN |
| External ID | CONFIRMED (`Id` + item id) | CONFIRMED (`ExternalId` + offerId concept) | UNKNOWN |
| Photos | PARTIAL | PARTIAL | UNKNOWN |
| Public image URLs required | PARTIAL | CONFIRMED (FullUrl) | UNKNOWN |
| Authentication | PARTIAL (OAuth + tariff) | PARTIAL (ACCESS KEY) | UNKNOWN |
| Import report | CONFIRMED (Autoload v4) | PARTIAL | UNKNOWN |
| Rate limits | PARTIAL (per-method in OpenAPI) | PARTIAL (historical 10 rps) | UNKNOWN |
| Webhook (listing) | UNKNOWN | NOT SUPPORTED | NOT SUPPORTED |
| Polling | CONFIRMED | PARTIAL | UNKNOWN |

Footnotes: see source register A*, C*, D*.

---

## 16. Implementation readiness & GO/NO-GO

| Provider | Readiness | GO/NO-GO | Why |
|---|---|---|---|
| Avito | READY WITH ACCOUNT ACCESS + BLOCKED BY DOCUMENTATION (realty template) + BLOCKED BY INTERNAL DATA (photos) | **PARTIAL** | Transport clear; category schema incomplete |
| CIAN | READY WITH ACCOUNT ACCESS + BLOCKED BY INTERNAL DATA + unpublish UNKNOWN | **PARTIAL** | Best-documented feed; live XSD refresh + unpublish confirmation needed |
| Domclick | BLOCKED BY DOCUMENTATION (+ credentials) | **NO** | No public LT rent schema retrieved |

**Recommended next implementation stage:**  
Stage **8.2.1** (docs/account unlock): capture live Avito realty Autoload template + live CIAN XSD/HelpDesk unpublish + Domclick PRO schema under NDA/account.  
Only then Stage **8.2** feed generators for CIAN (first) and Avito Autoload (second). Domclick later.

---

## 17. Repository note

This stage must only add:

- `docs/stage-8.2.0-official-publication-protocol-audit.md`
- `docs/stage-8.2.0-provider-field-matrix.md`
- `docs/stage-8.2.0-open-questions.md`

No application code changes.
