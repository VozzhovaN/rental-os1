# Stage 12.5 — Financial Dashboard

## Purpose

`/crm/finance` answers: **how much did the business actually earn?**

Operational rental Dashboard (`/crm/dashboard`) is unchanged (bookings, occupancy, calendar).

## KPI definitions (Stage 12.4 semantics)

| KPI | Meaning |
|-----|---------|
| **Gross Rent** | Paid rental turnover (ST+LT), deposits excluded |
| **Business Revenue** | OWN → net rental revenue; COMMISSION → `CommissionPayment` received |
| **Expenses** | Operator expenses (`BUSINESS_EXPENSE` / OPERATOR responsibility) |
| **Net Profit** | Business Revenue − Operator Expenses |

PASS_THROUGH guest rent on COMMISSION+OPERATOR is **not** business revenue.

## Filters

- Period: today / week / month (default) / quarter / year / custom
- Property
- Management: ALL / OWN / COMMISSION
- Segment: ALL / SHORT_TERM / LONG_TERM / SALES

All widgets share one `getFinanceDashboard` DTO.

## Donuts

### Profit by direction

Level 1: Short-term / Long-term (positive contributions only).  
Sales omitted while `SALES_FINANCE_REVENUE_GAP`.

Level 2: Properties within a direction.  
Negative property profits → **Убыточные объекты**, not donut slices.

### Expenses by direction

Level 1: Short-term / Long-term / **Общие расходы** (`propertyId = null`).  
Level 2: by Property (or category for GENERAL).  
Level 3: expense categories for a Property.

Unclassified property expenses (no booking/contract) stay on the Property P&L and are **not** auto-allocated into Sales.

## Reconciliation

```
Σ Property Net Profit − General Expenses = Business Net Profit
```

(when segment = ALL)

## Timeline

Series: Gross Rent, Business Revenue, Expenses, Net Profit.  
Granularity: day (≤40d), week (≤92d), else month.

## Sales finance audit

**SALES_FINANCE_REVENUE_GAP**

- `SaleListing.price` ≠ revenue  
- Sale `Deposit` ≠ revenue  
- `PURCHASED` alone ≠ revenue  
- No sale commission FT path  

Dashboard shows an explicit banner; Sales segment totals are 0.

## API

- `GET /api/finance/dashboard`
- `GET /api/finance/dashboard/drilldown`

AUTH_REQUIRED, no-store, strict Zod. Client cannot supply totals.

## Pages

| Route | Role |
|-------|------|
| `/crm/finance` | Overview |
| `/crm/finance/properties` | Property table |
| `/crm/finance/properties/[id]` | Property economics |
| `/crm/finance/operations` | Ledger |
| `/crm/finance/commissions` | Commission KPIs + payments |
| `/crm/finance/expenses` | Expense list |
| `/crm/finance/reports` | Managerial report |

Charts: pure SVG (no chart library dependency).
