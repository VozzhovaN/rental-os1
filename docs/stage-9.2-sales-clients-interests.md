# Stage 9.2 — Sales Clients + Buyer Interest

**Project:** rental-os  
**Stage:** 9.2  
**Type:** IMPLEMENTATION  
**Date:** 2026-09-21  

Контур клиентов продажи: `Buyer` ↔ `BuyerInterest` ↔ `SaleListing`.  
Не Guest, не Viewing/Deposit/Purchase.

---

## Models

### Buyer

Отдельная CRM-сущность. Поля: `name` (required), `phone?`, `email?`, `messengerType?` (MAX|TELEGRAM), `messengerContact?`, `notes?`.

### BuyerInterest

N:M через junction. Unique `(buyerId, saleListingId)`.  
`saleListingId` **не** хранится на Buyer.

### BuyerInterestStatus

`INTERESTED` → `VIEWING_REQUESTED` → `VIEWING_SCHEDULED` → `VIEWING_COMPLETED` → `THINKING` → `DEPOSIT_PAID` → `PURCHASED`  
плюс shortcuts и `REFUSED`. `PURCHASED` / `REFUSED` — терминальные.

---

## FSM

Централизовано в `lib/buyer-interest-fsm.ts`.

**Manual Stage 9.2 targets:** INTERESTED, VIEWING_REQUESTED, VIEWING_SCHEDULED, THINKING, REFUSED.

**Not writable via Stage 9.2 API/UI:** VIEWING_COMPLETED, DEPOSIT_PAID, PURCHASED  
(зарезервированы под будущие workflow; внутренний `allowWorkflowStatuses` для тестов/будущего).

PATCH interest: notes + safe status через transition service.  
`buyerId` / `saleListingId` immutable.

Новый интерес запрещён для SaleListing `SOLD` / `ARCHIVED`.

---

## API

| Method | Path |
|---|---|
| GET/POST | `/api/buyers` |
| GET/PATCH | `/api/buyers/[id]` |
| GET/POST | `/api/buyer-interests` |
| GET/PATCH | `/api/buyer-interests/[id]` |

Filters: `buyerId`, `saleListingId`, `status`.  
Create interest: idempotent (return existing).

---

## CRM

| Route | Purpose |
|---|---|
| `/crm/sales/clients` | list + search |
| `/crm/sales/clients/new` | create |
| `/crm/sales/clients/[id]` | card + interests |
| `/crm/sales/clients/[id]/edit` | edit |

SaleListing card: section «Клиенты / заинтересованные».

Nav: Продажи · Объекты / Продажи · Клиенты.

---

## Non-goals

Viewing, Deposit, Purchase transaction, BuyerHistory, SalePublication, marketplace sale feeds.
