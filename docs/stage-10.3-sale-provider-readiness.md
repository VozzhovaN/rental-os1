# Stage 10.3 — Sale Provider Readiness (AVITO + DOMCLICK)

## AVITO

| Item | Status |
|---|---|
| Official mechanism | **CONFIRMED** — Autoload XML/CSV/Excel for realty after tariff (`avito.ru/business/tools/autoload`) |
| Sale category template «Квартиры / Продам» | **BLOCKED_BY_PROVIDER_CONFIRMATION** — live `autoload.avito.ru/format/realty` captcha/timeout; no verified field map in repo |
| Serializer / preview / feed | **NOT_IMPLEMENTED** (intentionally) |
| Status sync | **BLOCKED_BY_PROVIDER_ACCESS** (Autoload reports API exists; scopes/account not wired for sale) |
| Unpublish | **BLOCKED_BY_PROVIDER_CONFIRMATION** |
| Contour | SalePublication only — **never** ChannelListing / short-term Avito adapter |

## DOMCLICK

| Item | Status |
|---|---|
| Official mechanism | **CONFIRMED** (product concept) — partner XML feed in LK |
| Secondary («вторичка») schema | **BLOCKED_BY_PROVIDER_ACCESS** — `domclick.ru/validation` WAF/401 |
| New-build feed | Out of Stage 10.3 scope |
| Serializer / preview / feed | **NOT_IMPLEMENTED** (intentionally) |
| Status sync | **BLOCKED_BY_PROVIDER_ACCESS** |
| Unpublish | **BLOCKED_BY_PROVIDER_CONFIRMATION** |
| Contour | SalePublication only — **never** LongTerm Publication |

## Property data gaps (vs typical realty sale feeds)

| Field | Classification |
|---|---|
| address, city, area, rooms, floor, totalFloors, type, photos, price, description, publication phone | **AVAILABLE** |
| coordinates (lat/lng) | **MISSING_OPTIONAL** (CIAN warning; Avito/Domclick unknown until template) |
| cadastral number, building year, wall material, ceiling height, bathroom type, balcony/loggia, elevator, renovation | **MISSING_OPTIONAL** / unknown until provider template — **no schema expansion** |
| Mandatory unknowns without template | Documented as **MISSING_REQUIRED_PROVIDER_FIELD** when template confirms — none frozen this stage |

## Implementation

- Capability metadata: `lib/publications/providers/sale-capabilities.ts`
- Avito: `lib/publications/providers/avito/sale/*` (diagnostics only)
- Domclick: `lib/publications/providers/domclick/sale/*` (diagnostics only)
- Guards: blocked channels cannot `prepare` → PUBLISHING or `CONFIRM_PUBLISHED`
- UI: Авито/Домклик show blockers; no fake XML/prepare buttons
- CIAN sale unchanged (READY feed)

## Stage 10 matrix

| Provider | Feed | Preview | Status sync | Unpublish |
|---|---|---|---|---|
| CIAN SALE | READY | READY | BLOCKED_BY_PROVIDER_ACCESS | BLOCKED_BY_PROVIDER_CONFIRMATION |
| AVITO SALE | BLOCKED_BY_PROVIDER_CONFIRMATION | BLOCKED_BY_PROVIDER_CONFIRMATION | BLOCKED_BY_PROVIDER_ACCESS | BLOCKED_BY_PROVIDER_CONFIRMATION |
| DOMCLICK SALE | BLOCKED_BY_PROVIDER_ACCESS | BLOCKED_BY_PROVIDER_ACCESS | BLOCKED_BY_PROVIDER_ACCESS | BLOCKED_BY_PROVIDER_CONFIRMATION |
