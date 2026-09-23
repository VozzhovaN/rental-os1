# Stage 9.3 — Sales Viewings + Deposits

**Project:** rental-os  
**Stage:** 9.3  
**Type:** IMPLEMENTATION  
**Date:** 2026-09-21  

Операционный pre-sale workflow: показы и задатки по `BuyerInterest`.

---

## Viewing

| Field | Notes |
|---|---|
| `buyerInterestId` | parent interest |
| `scheduledAt` | required |
| `status` | SCHEDULED → COMPLETED / CANCELLED / NO_SHOW |
| `notes` | optional |

Rules:
- schedule blocked for PURCHASED/REFUSED interest
- schedule → interest `VIEWING_SCHEDULED` when FSM allows
- complete → interest `VIEWING_COMPLETED` when FSM allows
- cancel / no-show do **not** set REFUSED
- new viewing allowed after CANCELLED/NO_SHOW
- no hard delete; no arbitrary status PATCH

## Deposit

Sales deposit only — unrelated to `LongTermListing.deposit`.

| Field | Notes |
|---|---|
| `amount` | int > 0 |
| `status` | PENDING → PAID → REFUNDED / FORFEITED |
| `paidAt` | set on pay |

**Invariant:** one SaleListing may have at most one active `PAID` deposit across all interests.  
Conflict → `409` + `code: SALE_LISTING_ALREADY_HAS_PAID_DEPOSIT`.

Pay → interest `DEPOSIT_PAID` when FSM allows.  
Refund/forfeit leave interest status unchanged (Stage 9.4 reconciles).  
No automatic PURCHASED.

## Transactions

- schedule: create Viewing + optional interest transition  
- complete: Viewing COMPLETED + optional VIEWING_COMPLETED  
- pay: conflict check + Deposit PAID + paidAt + optional DEPOSIT_PAID  

## API

| Action | Route |
|---|---|
| list/create viewings | `GET/POST /api/buyer-interests/[id]/viewings` |
| get viewing | `GET /api/viewings/[id]` |
| complete/cancel/no-show | `POST /api/viewings/[id]/{complete\|cancel\|no-show}` |
| list/create deposits | `GET/POST /api/buyer-interests/[id]/deposits` |
| get deposit | `GET /api/deposits/[id]` |
| pay/refund/forfeit | `POST /api/deposits/[id]/{pay\|refund\|forfeit}` |

## UI

Buyer card: Просмотры + Задатки with state actions.  
SaleListing card: read-only activity lists.

Manual interest targets no longer include VIEWING_SCHEDULED / VIEWING_COMPLETED / DEPOSIT_PAID / PURCHASED.

## Stage 9.4 dependency

Purchase workflow, SaleListing→SOLD, refusal of other buyers, and deposit/interest reconciliation after REFUNDED/FORFEITED.
