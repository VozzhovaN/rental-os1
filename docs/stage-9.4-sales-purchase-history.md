# Stage 9.4 — Sales Purchase + History

## BuyerHistory

Append-only audit timeline for Sales buyers (`BuyerHistory` + `BuyerHistoryType`).

- Written only by server-side services (same Prisma transaction as the business mutation when possible).
- No edit/delete APIs.
- Optional NOTE via `POST /api/buyers/[id]/history` (message only).
- Read: `GET /api/buyers/[id]/history` (optional `buyerInterestId` filter).
- History starts from Stage 9.4 actions; no invented backfill for older seed rows.

## Purchase preconditions

`POST /api/buyer-interests/[id]/purchase` → `completePurchase`:

- BuyerInterest exists
- SaleListing not `SOLD` / not `ARCHIVED`
- BuyerInterest status must be `DEPOSIT_PAID` (conservative default; no silent purchase-without-deposit)
- Not `REFUSED`

## Atomic transaction

One Prisma `$transaction`:

1. Re-check listing not SOLD / interest still purchasable
2. Winner → `PURCHASED`
3. SaleListing → `SOLD`
4. `PURCHASE_COMPLETED` history
5. Other non-terminal interests → `REFUSED` + history `"Объект продан другому покупателю"`

Deposit statuses are **not** auto-changed on purchase (PAID stays PAID).

## Other-buyer refusal

Active peers are refused, not deleted. Already `REFUSED` / `PURCHASED` are left alone; conflicting second `PURCHASED` → conflict.

## SOLD protection

After `SOLD`, create interest / viewing / deposit / pay deposit / another purchase return **409** with `SALE_LISTING_ALREADY_SOLD`. Historical rows remain readable.

## Idempotency

Repeating purchase on the same winning interest when already `PURCHASED` + listing `SOLD` returns success without duplicating `PURCHASE_COMPLETED` history.

## Concurrency limitation

Purchase uses transactional re-checks. SQLite has no strong row-level locking; under simultaneous writers a race window can remain. Do not rely on UI state alone.

## UI

- Buyer card: **История** timeline + «Завершить покупку» only when `DEPOSIT_PAID` (with confirm).
- Sale listing card: clear **Продан**, winner buyer + purchase date from history; add-interest / new viewing / new deposit hidden or empty.
- Sales list continues to show `SOLD` via existing labels.

## Future SalePublication boundary

Marketplace / XML / Avito-sale / CIAN-sale / Domclick publication is **out of scope**. Internal CRM purchase does not imply external publication.
