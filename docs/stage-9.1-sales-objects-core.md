# Stage 9.1 — Sales Objects Core

**Project:** rental-os  
**Stage:** 9.1 (9.1A data/API + 9.1B CRM UI + 9.1C seed/tests)  
**Type:** INTERNAL CRM — sale property contour  
**Date:** 2026-09-21  

Отдельный контур продажи недвижимости. Не связан с Dashboard, Booking, Guest, LongTerm, ChannelListing, CIAN/Avito publication.

---

## Models

### SaleListing (1:1 Property)

| Field | Notes |
|---|---|
| `propertyId` | `@unique`, immutable after create |
| `status` | `SaleListingStatus` |
| `price` | sale price in ₽; SoT for sale, not Property/LongTerm prices |
| `specialOfferPrice` / `specialOfferText` | optional; never replaces base `price` |
| marketing texts | `marketingTitle`, `description`, `advantages`, `infrastructure`, `security`, `parking`, `transport` |

Physical facts stay on **Property**. SaleListing holds sale marketing/business data only.

### SaleListingStatus

| Status | Meaning |
|---|---|
| `DRAFT` | preparing |
| `ACTIVE` | offered for sale; requires `price > 0` |
| `PAUSED` | temporarily not offered |
| `SOLD` | reserved for future purchase workflow — not writable via Stage 9.1 PATCH schema |
| `ARCHIVED` | soft-removed from active sales |

### SaleListingPhoto

Links existing `PropertyPhoto` to a SaleListing:

- `saleListingId` + `propertyPhotoId` unique
- `order` for display; first = cover
- same-property ownership enforced server-side
- no new file/image storage

```
PropertyPhoto
├─ LongTermListingPhoto
└─ SaleListingPhoto
```

---

## API

| Method | Path | Behavior |
|---|---|---|
| GET/POST | `/api/sale-listings` | list; create (idempotent per Property) |
| GET/PATCH/DELETE | `/api/sale-listings/[id]` | read; update; DELETE → ARCHIVED |
| GET/PUT | `/api/sale-listings/[id]/photos` | read/replace photo selection |

Errors: `400` validation, `404` not found, `409` conflict (when applicable).

Writable PATCH whitelist excludes `propertyId` and `SOLD`.

---

## CRM routes

| Route | Purpose |
|---|---|
| `/crm/sales` | redirect → properties |
| `/crm/sales/properties` | list |
| `/crm/sales/properties/new` | add existing Property |
| `/crm/sales/properties/[id]` | card (PROPERTY + SALE) |
| `/crm/sales/properties/[id]/edit` | edit + photos |

Nav: **Продажи** → objects list. Clients UI is Stage 9.2+.

Archive: confirm → DELETE (status ARCHIVED, no hard delete).

---

## Price semantics

- Base **Цена продажи** always stored and shown.
- **Специальная цена** optional overlay; does not overwrite base price.
- Display uses ₽ formatting; storage remains integer rubles.

---

## Stage 9.1 non-goals

Not implemented:

- Buyer / BuyerInterest / Viewing / Deposit / Purchase / BuyerHistory
- SalePublication, Avito/CIAN/Domclick sale feeds
- Manual UI action to set `SOLD`
- Sales analytics, buyers count on list

---

## Seed

Idempotent upserts:

1. `test-object-2` → ACTIVE SaleListing with `price > 0`
2. `test-object-3` → DRAFT SaleListing

No Buyer/Viewing/Deposit seed data.
