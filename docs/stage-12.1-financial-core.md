# Stage 12.1 — Financial Core

## Money

- **Storage:** integer RUB **major units** (rubles), same as `Booking.totalAmount` / `Property.dailyPrice`
- **Not** floating-point; **not** kopecks (would break existing CRM money fields)
- **Currency:** `RUB` only (`FinancialCurrency`)
- **Sign:** `amount` always `> 0`; direction from `type` (+ `adjustmentDirection` for ADJUSTMENT)

## Ledger

`FinancialTransaction` — immutable facts. No hard delete API.

Types: `INCOME` | `EXPENSE` | `OWNER_PAYOUT` | `ADJUSTMENT`  
Categories: rent/commission/owner share, operating expenses, payout, adjustment  
Sources: `MANUAL` | `BOOKING` | `LONG_TERM` | `OWNER_SETTLEMENT` | `SYSTEM_ADJUSTMENT`

## Idempotency

Optional unique `sourceKey` (e.g. `BOOKING:{id}:RENT`). Manual rows leave `sourceKey` null.

## Deletion / correction

Hard delete forbidden → use ADJUSTMENT with required reason.  
Booking/LongTermListing delete: `ON DELETE SET NULL` (history kept). Property: `RESTRICT`.

## Aggregates

incomeTotal, expenseTotal, ownerPayoutTotal, adjustmentNet, netCashMovement  
(= income − expense − ownerPayout + adjustmentNet)

## Owner model

`Property.ownerName` / `ownerPhone` strings — **OWNER_MODEL_GAP** (no Owner entity).

## Long-term

`LongTermListing` is marketing, not a lease — **LONG_TERM_CONTRACT_MODEL_GAP**. Optional FK for future trace only.
