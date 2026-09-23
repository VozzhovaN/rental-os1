# Stage 12.4 — Property Economics

> **Pivot:** Owner settlement workflows are deferred. `Owner` / `OwnerPayout` schema remains for future use (`OWNER_SETTLEMENT_FUTURE_GAP`). This stage focuses on **OWN vs COMMISSION unit economics**.

## Management types

| Type | Business revenue | Gross rent in operator cash |
|------|------------------|----------------------------|
| **OWN** | Net paid rent (ST+LT, excl. deposit) | Same (via ledger) |
| **COMMISSION + OPERATOR** | Commission received (`CommissionPayment`) | Full guest rent (pass-through) |
| **COMMISSION + OWNER_DIRECT** | Commission received only | **Not** in operator ledger |

## Rent collection mode

- `OPERATOR` — operator collects guest/tenant rent (default).
- `OWNER_DIRECT` — owner collects rent; operator records `CommissionPayment` separately.
- **OWN + OWNER_DIRECT is forbidden.**

## Gross rent

```
grossRent = ST net paid + LT rent allocated (RENT charges only)
```

- Deposits excluded.
- ST refunds reduce gross.

## Business revenue

```
OWN:           businessRevenue = ownRentalRevenue = grossRent (OWN properties)
COMMISSION:    businessRevenue = Σ CommissionPayment.amount
netProfit = businessRevenue − operatorExpenses
```

## Commission

```
commissionAccrued (ST) = commission(netPaid, Booking.commissionRateBps snapshot)
commissionAccrued (LT) = commission(rentPaidAllocated, LongTermContract.commissionRateBps)
commissionReceived     = Σ CommissionPayment
commissionReceivable   = max(accrued − received, 0)
commissionOverpayment  = max(received − accrued, 0)
```

`ownerShare` / allocation metrics remain **calculation-only** — not business profit.

## Ledger economic roles

| Event | economicRole |
|-------|--------------|
| OWN rent payment | `BUSINESS_REVENUE` |
| COMMISSION rent (operator collects) | `PASS_THROUGH` |
| COMMISSION rent (owner direct) | *(no FT)* |
| Commission from owner | `BUSINESS_REVENUE` / `OPERATOR_COMMISSION` |
| Operator expense | `BUSINESS_EXPENSE` |
| Guest refund (OWN) | `BUSINESS_EXPENSE` |
| Guest refund (COMMISSION operator) | `PASS_THROUGH` |
| Security deposit | `NEUTRAL` |

## Operator expenses

Categories: `TAX`, `ACQUIRING`, `CLEANING`, `UTILITIES`, `ADVERTISING`, `REPAIR`, `SUPPLIES`, `PLATFORM_COMMISSION`, `LAUNDRY`, `OTHER_EXPENSE`.

- Property-linked or global (`propertyId = null`).
- `expenseResponsibility = OWNER` excluded from operator P&L.

## Gaps

- **HISTORICAL_COMMISSION_PAYMENT_GAP** — no backfill of `CommissionPayment` for past periods.
- **OWNER_SETTLEMENT_FUTURE_GAP** — owner balance/settlement UI not expanded.

## API

- `GET/POST /api/commission-payments`
- `GET /api/properties/[id]/economics`
- `GET /api/bookings/[id]/commission`
- `GET /api/long-term-contracts/[id]/commission`
- `GET /api/finance/summary` — adds `businessRevenue`, `netProfit`, `grossRent`, etc. (`incomeTotal` unchanged for dashboard cash view).
