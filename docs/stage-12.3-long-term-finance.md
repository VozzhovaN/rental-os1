# Stage 12.3 — Long-term contracts, charges, payments

## Core distinction

| Entity | Role |
|--------|------|
| **LongTermListing** | Marketing card / publication |
| **LongTermContract** | Real lease with Guest tenant |

## Contract snapshots

- `monthlyRent` — from listing at create; listing price changes do not rewrite contract
- `commissionRateBps` — from `Property.commissionMonthly` (OWN → 10000)
- `depositAmount` — from listing deposit; **not** rent; **not** commission base
- `paymentDay` — 1–28

## Charge / Payment / Allocation

- **Charge** = accrued (RENT / DEPOSIT / ADJUSTMENT)
- **Payment** = cash received
- **Allocation** = payment → charge (auto oldest OPEN, or explicit)

Idempotent rent keys: `LONG_TERM:{contractId}:RENT:YYYY-MM`

## Partial first month

`prorationMode = MANUAL_FIRST_PERIOD`: if start day ≠ 1, first calendar month is **not** auto-generated.

## Ledger

One `FinancialTransaction` per payment: `LONG_TERM_PAYMENT:{paymentId}`  
Category `RENT_PAYMENT` or `SECURITY_DEPOSIT_RECEIVED` if 100% deposit.  
Commission / owner share = summary metrics only (no extra INCOME).  
`longTermContractId` on FT. OWNER_PAYOUT → Stage 12.4.

## Limitations

- **LONG_TERM_RATE_CHANGE_LIMITATION** — DRAFT-only field edits; no mid-lease rate history
- Deposit return workflow category reserved (`SECURITY_DEPOSIT_RETURNED`), full workflow not required
- Publication not auto-unpublished
