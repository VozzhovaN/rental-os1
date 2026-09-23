# Stage 12.2 — Short-term booking finance

## Audit summary

| Item | Finding |
|------|---------|
| Gross | `Booking.totalAmount` (Int RUB) — source of truth |
| Nightly price | Not stored; not recalculated |
| Statuses | PENDING / CONFIRMED / CANCELLED / COMPLETED unchanged |
| Payment model | **Was missing** → `BookingPayment` + `BookingPaymentRefund` |
| Ownership | `Property.managementType` OWN \| COMMISSION |
| Commission % | `Property.commissionDaily` → snapshot `Booking.commissionRateBps` |
| Dashboard | Untouched (`lib/dashboard.ts` still sums booking totals by status) |

## Gaps

- **BOOKING_PAYMENT_MODEL_GAP** — closed by BookingPayment
- **BOOKING_REFUND_MODEL_GAP** — closed by BookingPaymentRefund + ledger GUEST_REFUND
- **BOOKING_FINANCE_DATA_GAP** — closed for short-term (snapshot + payments)
- PROPERTY_OWNERSHIP_GAP — not flagged (OWN/COMMISSION exists)
- OWNER_MODEL_GAP (12.1) — still open (no Owner entity); OWNER_PAYOUT is Stage 12.4

## Money

- Integer RUB major units (Stage 12.1)
- Commission: `applyCommissionBps(gross, bps)` half-up to nearest ruble
- `bps`: 10_000 = 100%; Property float % converted only at snapshot boundary via `percentToBps`
- Identity: `grossAmount === commissionAmount + ownerShareAmount` (COMMISSION); OWN → ownerShare = 0, commission = gross

## Cash vs allocation

- **Cash:** BookingPayment → ledger `INCOME` / `RENT_PAYMENT` (`BOOKING_PAYMENT:{id}:RENT`)
- **Cash out:** Refund → `EXPENSE` / `GUEST_REFUND` (`BOOKING_PAYMENT_REFUND:{id}:REFUND`)
- **Allocation:** commission / owner share — **breakdown only**, never posted as extra INCOME

## Snapshot

`commissionRateBps` locked on first payment / ensureCommissionSnapshot. Property rate changes do not rewrite history.

## Avito

Imported bookings use the same finance domain; import does **not** create payments.
