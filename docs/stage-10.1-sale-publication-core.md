# Stage 10.1 — Sale Publication Core + Data Readiness

## SalePublication

Separate contour from LongTerm `Publication` and short-term `ChannelListing`:

```
Property → SaleListing → SalePublication → (future provider adapter)
```

- Unique `(saleListingId, salesChannelId)`
- Channels: `AVITO` | `CIAN` | `DOMCLICK`
- Reuses shared `PublicationStatus` enum and FSM (`lib/publications/state-machine.ts`)
- Fields: status, externalId/externalStatus, lastAttemptAt/lastSuccessAt/lastError*, lastSerializedHash

## FSM

Same events as LongTerm Publication via `applySalePublicationEvent`.  
`prepareSalePublication` only applies `START_PUBLISH` → `PUBLISHING`.  
It never marks `PUBLISHED` and never calls providers.

## Normalized data

`NormalizedSalePublicationData` from Property (facts) + SaleListing (marketing/contact) + SaleListingPhoto order.  
No Buyer / Viewing / Deposit / BuyerHistory fields.

## Readiness

`validateSalePublicationReadiness` → `{ ready, errors[], warnings[] }`.  
SOLD / ARCHIVED block readiness (`LISTING_SOLD` / `LISTING_ARCHIVED`). Existing publications are not deleted.

## Hash

SHA-256 of canonical normalized payload. Stored on prepare as `lastSerializedHash`.

## Security

- Strict create schema: `salesChannelId` only
- saleListingId / salesChannelId immutable after create
- No client status / externalId / hash PATCH
- SaleListing contact fields validated; empty → null

## Provider boundary

Stage 10.1 status for CIAN / AVITO / DOMCLICK:

`CORE_READY_PROVIDER_MAPPING_PENDING`

No XML, feeds, HTTP clients, credentials, or unpublish.
