# Stage 10.2 — CIAN Sale XML Feed + Diagnostics

## Supported property types

**CONFIRMED for Stage 10.2:** `APARTMENT`, `STUDIO` → Category `flatSale`.

Rejected with `CIAN_UNSUPPORTED_PROPERTY_TYPE`: `HOUSE`, `OTHER`, land, commercial, new-build.

## Official mapped fields

| XML | Source | Status |
|---|---|---|
| `Category` | constant `flatSale` | **CONFIRMED** — official doc anchor `#flatSale` |
| `Feed_Version` | `2` | **CONFIRMED** (same schema family as flatRent) |
| `ExternalId` | `SaleListing.id` | **CONFIRMED** pattern |
| `Description` | SaleListing description (+ marketing blocks via normalize) | CONFIRMED length 15–3000 (shared CIAN policy) |
| `Address` | Property city + address | CONFIRMED |
| `FlatRoomsCount` | Property.rooms (STUDIO uses raw rooms; no invented `9`) | CONFIRMED field; studio special value NOT invented |
| `TotalArea` | Property.area | CONFIRMED (archived/schema family) |
| `FloorNumber` | Property.floor | CONFIRMED |
| `Building/FloorsCount` | Property.totalFloors (optional) | CONFIRMED optional |
| `BargainTerms/Price` | SaleListing.price | CONFIRMED structure (same BargainTerms family as rent; no LeaseTermType/Deposit) |
| `BargainTerms/Currency` | `rur` | CONFIRMED policy (same as LT) |
| `Phones/PhoneSchema` | SaleListing publication contact | CONFIRMED |
| `Photos/PhotoSchema` | SaleListingPhoto → PropertyPhoto HTTPS URLs | CONFIRMED |

## Intentionally unmapped / blocked

| Field | Status |
|---|---|
| Coordinates | NOT_IMPLEMENTED — Property has no lat/lng (warning only) |
| specialOffer* | NOT_IMPLEMENTED — no confirmed sale XML mapping |
| marketingTitle | NOT_IMPLEMENTED as CIAN Title |
| contact name | NOT_IMPLEMENTED |
| Buyer / Viewing / Deposit / History | never serialized |
| LeaseTermType / Deposit | rent-only — not used for sale |

## Validation

Baseline sale readiness + `validateCianSalePublication`.

## XML / preview / feed

- Preview: `GET /api/sale-listings/[id]/publications/cian/preview` (+ `?download=1`)
- Filename: `cian-sale-{saleListingId}.xml`
- Public feed: `GET /api/feeds/cian/sale.xml` (separate from long-term)
- Inclusion: ACTIVE SaleListing + CIAN SalePublication in `PUBLISHING|UPDATE_PENDING|PUBLISHED` + readiness + CIAN validation
- Invalid objects isolated

## Hash

- `normalizedHash` — NormalizedSalePublicationData
- `cianPayloadHash` — canonical CianSalePayload
- Prepare stores `cianPayloadHash` as `lastSerializedHash`
- PUBLISHED + hash change → `UPDATE_PENDING` (same FSM as LT)

## Status / unpublish

| Flag | Value |
|---|---|
| `CIAN_SALE_STATUS_SYNC` | **BLOCKED_BY_PROVIDER_ACCESS** |
| `CIAN_SALE_UNPUBLISH` | **BLOCKED_BY_PROVIDER_CONFIRMATION** |

XML generation / preview / feed **never** marks `PUBLISHED`.

SOLD: excluded from feed; UI shows provider unpublish required; existing SalePublication not deleted.
