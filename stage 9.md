PROJECT: rental-os
STAGE 9
NAME: SALES CRM CORE
TYPE: MAJOR IMPLEMENTATION

GOAL:
Implement a complete internal real-estate Sales CRM contour in one stage:

Property
   ↓
SaleListing
   ↓
Buyer ↔ BuyerInterest
             ↓
           Viewing
             ↓
           Deposit
             ↓
      PURCHASED / REFUSED

This is an INTERNAL CRM stage.

NO marketplace publication in Stage 9.
NO Avito Sale API.
NO CIAN Sale API/XML.
NO Domclick Sale API/XML.

==================================================
0. WORK MODE — IMPORTANT
==================================================

Minimize token usage.

Do NOT reread all historical Stage 8 documentation.

Inspect only relevant current code:
- prisma/schema.prisma
- Property
- PropertyPhoto
- LongTermListing + photos
- Guest/GuestHistory patterns
- Booking patterns
- current CRM navigation/layout
- validation/service/API patterns
- Publication only to ensure Sales does not interfere with it

Reuse existing project conventions.

Do not produce intermediate long reports.

Before implementation output only a SHORT audit:

STAGE 9 AUDIT
Reusable:
Missing:
Schema plan:
Main routes:
Risks:

Then continue automatically unless there is a serious architecture conflict.

==================================================
1. BUSINESS BOUNDARY
==================================================

Sales is a completely separate business contour.

Dashboard = short-term only.

SaleListing MUST NOT:
- appear on Dashboard;
- create Booking;
- affect occupancy;
- affect short-term income;
- affect Guest;
- affect LongTermListing;
- affect ChannelListing;
- affect CIAN long-term feed;
- affect Avito short-term integration.

Property remains the single physical object.

Architecture:

Property
├── short-term contour (existing)
├── LongTermListing (existing)
└── SaleListing (NEW)

==================================================
2. CRM NAVIGATION
==================================================

Add:

Продажи
├── Объекты
└── Клиенты

Expected routes:

/crm/sales
/crm/sales/properties
/crm/sales/properties/new
/crm/sales/properties/[id]
/crm/sales/properties/[id]/edit

/crm/sales/clients
/crm/sales/clients/new
/crm/sales/clients/[id]
/crm/sales/clients/[id]/edit

If /crm/sales can redirect to /crm/sales/properties, that is acceptable.

Follow existing CRM visual language.

Do not redesign the whole CRM.

==================================================
3. SALE LISTING
==================================================

Create SaleListing linked 1:1 with Property.

Conceptual model:

SaleListing {
  id
  propertyId @unique

  status

  price

  marketingTitle?
  description?

  specialOfferPrice?
  specialOfferText?

  advantages?
  infrastructure?
  security?
  parking?
  transport?

  createdAt
  updatedAt
}

Adapt naming/types to existing LongTermListing conventions where sensible.

Do NOT blindly duplicate fields if reusable factual data already belongs to Property.

SaleListing = sale marketing/business data.
Property = physical facts.

==================================================
4. SALE STATUS
==================================================

Create enum approximately:

SaleListingStatus {
  DRAFT
  ACTIVE
  PAUSED
  SOLD
  ARCHIVED
}

Semantics:

DRAFT = being prepared
ACTIVE = actively offered for sale
PAUSED = temporarily not offered
SOLD = transaction completed
ARCHIVED = removed from active sales workflow

Do not use Publication statuses here.

==================================================
5. SALE PRICE
==================================================

Sale price belongs to SaleListing.

Do NOT use:
Property.monthlyPrice
LongTermListing.monthlyPrice

Validate:
price >= 0 at storage level if project conventions require draft zero,
but ACTIVE sale listing must have price > 0.

specialOfferPrice:
optional.

Do not overwrite base price with special offer.

==================================================
6. SALE MARKETING CONTENT
==================================================

SaleListing has its own:

marketingTitle
description
specialOfferText
advantages
infrastructure
security
parking
transport

Do not reuse LongTermListing description.

Long-term and Sale marketing texts must remain independent.

==================================================
7. SALE PHOTOS
==================================================

Reuse existing:

PropertyPhoto

Create join model if needed:

SaleListingPhoto

Conceptually:

SaleListingPhoto {
  saleListingId
  propertyPhotoId
  order
}

Do NOT duplicate actual image records/files.

Architecture:

PropertyPhoto
   ├── LongTermListingPhoto
   └── SaleListingPhoto

Allow:
- select photos for sale;
- reorder;
- first ordered photo = cover conceptually.

No provider-specific photo tables.

==================================================
8. ADD PROPERTY TO SALES
==================================================

A Property is NOT automatically a SaleListing.

User manually adds an existing Property to Sales.

On:

/crm/sales/properties/new

select Property.

If SaleListing already exists:
do not duplicate it;
return/open existing SaleListing.

One Property → maximum one SaleListing.

==================================================
9. SALES OBJECT LIST
==================================================

/crm/sales/properties

Show useful fields:

- object/property
- sale price
- status
- number of interested buyers
- next viewing if available
- deposit state if applicable

Add basic filters:

status
search

Do not overbuild analytics.

==================================================
10. SALE OBJECT CARD
==================================================

/crm/sales/properties/[id]

Show:

OBJECT
- Property factual information

SALE
- price
- special offer
- marketing title
- description
- advantages
- photos
- status

CLIENT ACTIVITY
- interested buyers
- upcoming/recent viewings
- deposits
- purchased/refused outcomes

Actions:
- Edit sale listing
- Add interested buyer / link existing buyer
- Schedule viewing where applicable

No marketplace publication UI in Stage 9.

==================================================
11. BUYER
==================================================

Create Buyer as a separate entity.

DO NOT reuse Guest.

Buyer conceptual fields:

Buyer {
  id
  firstName?
  lastName?
  fullName or project-consistent name representation

  phone?
  email?

  messengerType?
  messengerContact?

  notes?

  createdAt
  updatedAt
}

Reuse MAX / TELEGRAM enum if semantically reusable.

Do not duplicate enum unnecessarily.

Buyer and Guest remain separate business entities.

==================================================
12. BUYER VALIDATION
==================================================

Buyer must have enough identifying/contact information.

At minimum:
- name required according to chosen model;
- phone/email optional unless business rule requires one;
- normalize empty strings to null;
- validate email when present;
- validate phone conservatively.

Do not implement external phone verification.

==================================================
13. BUYER LIST
==================================================

/crm/sales/clients

Show:

- name
- phone
- messenger
- number of interested properties
- nearest viewing if any
- current sales activity

Search:
name / phone / email

Keep UI compact.

==================================================
14. BUYER CARD
==================================================

/crm/sales/clients/[id]

Must be the operational sales client card.

Show:

CONTACTS

INTERESTED PROPERTIES

VIEWINGS

DEPOSITS

HISTORY

Allow:
- edit buyer;
- add interest in another SaleListing;
- schedule viewing;
- change interest status where valid;
- record deposit;
- record purchase/refusal.

==================================================
15. BUYER ↔ PROPERTY RELATION
==================================================

Buyer can be interested in multiple SaleListings.

SaleListing can have multiple Buyers.

Implement N:M through BuyerInterest.

Conceptual:

Buyer
  ↓
BuyerInterest
  ↓
SaleListing

Do NOT store saleListingId directly on Buyer.

==================================================
16. BUYER INTEREST
==================================================

Create BuyerInterest.

Conceptual:

BuyerInterest {
  id
  buyerId
  saleListingId

  status
  notes?

  createdAt
  updatedAt
}

Unique:

buyerId + saleListingId

No duplicate interest for same pair.

Repeated "add interest" should return/open existing relation or produce safe conflict according to current project API style.

==================================================
17. INTEREST STATUS
==================================================

Use:

INTERESTED
VIEWING_REQUESTED
VIEWING_SCHEDULED
VIEWING_COMPLETED
THINKING
DEPOSIT_PAID
PURCHASED
REFUSED

Do not use free-form status strings.

==================================================
18. INTEREST FSM
==================================================

Implement explicit transition validation.

Reasonable normal flow:

INTERESTED
→ VIEWING_REQUESTED
→ VIEWING_SCHEDULED
→ VIEWING_COMPLETED
→ THINKING
→ DEPOSIT_PAID
→ PURCHASED

But real work is not always linear.

Support justified shortcuts, for example:

INTERESTED → VIEWING_SCHEDULED
INTERESTED → REFUSED
VIEWING_COMPLETED → DEPOSIT_PAID
VIEWING_COMPLETED → REFUSED
THINKING → REFUSED
DEPOSIT_PAID → PURCHASED

Do NOT allow nonsensical resurrection:

PURCHASED → INTERESTED
REFUSED → DEPOSIT_PAID

Treat PURCHASED and REFUSED as terminal unless an explicit future reopen feature is added.

Put FSM logic in service/domain code, not UI only.

==================================================
19. VIEWING
==================================================

Create Viewing linked to BuyerInterest.

Conceptual:

Viewing {
  id
  buyerInterestId

  scheduledAt
  status

  notes?

  createdAt
  updatedAt
}

ViewingStatus:

SCHEDULED
COMPLETED
CANCELLED
NO_SHOW

Do not create Calendar/Occupancy entities.

Viewing does NOT affect rental occupancy.

==================================================
20. VIEWING WORKFLOW
==================================================

When valid viewing is scheduled:

BuyerInterest may transition to VIEWING_SCHEDULED.

When completed:

→ VIEWING_COMPLETED

Cancelled/NO_SHOW:
do not automatically mark buyer REFUSED.

Allow another viewing later.

One BuyerInterest may have multiple Viewings.

==================================================
21. VIEWING UI
==================================================

From Buyer card and SaleListing card allow:

«Назначить просмотр»

Fields:
- date/time
- notes

Show:
- upcoming viewings
- completed
- cancelled/no-show

Actions:
- complete
- cancel
- no-show

Use confirmation for destructive/state-changing actions where appropriate.

==================================================
22. DEPOSIT
==================================================

Create Deposit linked to BuyerInterest.

This is a SALE deposit, unrelated to LongTermListing.deposit.

Conceptual:

Deposit {
  id
  buyerInterestId

  amount
  paidAt
  status
  notes?

  createdAt
  updatedAt
}

DepositStatus:

PENDING
PAID
REFUNDED
FORFEITED

Use naming consistent with repository.

==================================================
23. DEPOSIT RULES
==================================================

amount > 0

When a deposit becomes PAID:
BuyerInterest → DEPOSIT_PAID

Do not mark property SOLD merely because deposit was paid.

REFUNDED/FORFEITED:
do not automatically infer purchase/refusal unless explicit action says so.

Keep financial meaning explicit.

==================================================
24. ONE ACTIVE PAID DEPOSIT POLICY
==================================================

Avoid contradictory sale state.

For one SaleListing, do not allow multiple buyers to simultaneously hold active PAID deposits unless current business requirements explicitly allow it.

Implement a server-side invariant.

If another BuyerInterest for same SaleListing already has a PAID deposit:
return 409 with machine-readable code.

Example:
SALE_LISTING_ALREADY_HAS_PAID_DEPOSIT

Use transaction where necessary.

==================================================
25. PURCHASE
==================================================

Provide explicit action:

«Покупка завершена»

This is NOT inferred merely from deposit.

On purchase:

BuyerInterest.status → PURCHASED

SaleListing.status → SOLD

This must happen atomically in a DB transaction.

Create history records in same transaction.

Do not affect Property.status automatically unless there is an existing clearly compatible business rule.

Do not delete Property.

==================================================
26. PURCHASE CONFLICT
==================================================

If SaleListing already SOLD:

another BuyerInterest cannot become PURCHASED.

Return 409.

Purchase action must be idempotent for the already purchased winning BuyerInterest if practical.

==================================================
27. OTHER BUYERS AFTER PURCHASE
==================================================

When one BuyerInterest becomes PURCHASED:

Do NOT delete other interests.

Preserve history.

Preferred:
transition other non-terminal interests for that SaleListing to REFUSED
with system history reason such as:

"Объект продан другому покупателю"

Do this transactionally.

Do not overwrite already terminal statuses unnecessarily.

==================================================
28. REFUSAL
==================================================

Explicit action:

«Отказ»

BuyerInterest → REFUSED

Optional note/reason.

Do not archive Buyer.

Do not delete interest.

History preserved.

==================================================
29. BUYER HISTORY
==================================================

Create BuyerHistory or equivalent immutable activity log.

Prefer separate entity.

Types conceptually:

BUYER_CREATED
BUYER_UPDATED
INTEREST_ADDED
INTEREST_STATUS_CHANGED
VIEWING_SCHEDULED
VIEWING_COMPLETED
VIEWING_CANCELLED
VIEWING_NO_SHOW
DEPOSIT_CREATED
DEPOSIT_PAID
DEPOSIT_REFUNDED
DEPOSIT_FORFEITED
PURCHASE_COMPLETED
REFUSED
NOTE

Adapt exact enum names if needed.

History should support:
- buyerId
- optional buyerInterestId
- event type
- message/details
- createdAt

Do not store secrets.

==================================================
30. HISTORY AUTOMATION
==================================================

History must be written automatically by server-side service functions.

Do not rely on frontend to create history.

Important operations and their history should preferably share a transaction.

==================================================
31. SERVICE LAYER
==================================================

Do not put complex workflows directly in route handlers.

Create/reuse services for:

SaleListing
Buyer
BuyerInterest
Viewing
Deposit
Purchase

Critical invariants belong server-side.

==================================================
32. API
==================================================

Implement REST endpoints following existing project style.

Expected conceptual routes:

/api/sale-listings
/api/sale-listings/[id]

/api/buyers
/api/buyers/[id]

/api/buyer-interests
/api/buyer-interests/[id]

/api/buyer-interests/[id]/viewings
/api/viewings/[id]

/api/buyer-interests/[id]/deposits
/api/deposits/[id]

/api/buyer-interests/[id]/purchase
/api/buyer-interests/[id]/refuse

Exact route structure may adapt to current conventions.

Do not create duplicate endpoints for the same operation.

==================================================
33. SECURITY / VALIDATION
==================================================

All mutation schemas:
Zod strict.

Use explicit writable field whitelist.

Prevent:
- buyerId reassignment through PATCH
- saleListingId reassignment through PATCH
- buyerInterestId reassignment
- arbitrary status assignment bypassing FSM
- mass assignment
- cross-resource IDOR

Nested resource IDs must actually belong to their parent.

Return:
400 validation
404 not found
409 business conflict

with existing project error format.

==================================================
34. DELETE POLICY
==================================================

Avoid destructive deletion for business records.

SaleListing:
DELETE should archive if existing project convention uses DELETE for archive.

Buyer:
do not hard delete when history/interests exist.

BuyerInterest:
do not hard delete; use REFUSED/terminal workflow.

Viewing/Deposit:
preserve audit trail.

If delete endpoints are unnecessary, do not create them.

==================================================
35. TRANSACTIONS / CONCURRENCY
==================================================

Use Prisma transactions for critical workflows:

- paid deposit invariant
- purchase
- automatic refusal of other buyers
- status + history updates

Do not rely on UI checks for uniqueness/invariants.

SQLite limitations should be documented if relevant.

==================================================
36. SALES UI
==================================================

Build usable CRM UI, not placeholder pages.

Required:

Sales object list
SaleListing create/edit/card

Buyer list
Buyer create/edit/card

BuyerInterest management

Viewing modal/form

Deposit modal/form

Purchase/refusal actions

History timeline

Reuse existing components/styles where possible.

Do not spend tokens redesigning the entire UI.

==================================================
37. SALES OVERVIEW
==================================================

On /crm/sales/properties provide only lightweight useful counters if cheap:

Active sale listings
Interested buyers
Upcoming viewings
Paid deposits
Sold objects

Do NOT modify short-term Dashboard.

No complex analytics/charts in Stage 9.

==================================================
38. PHOTO UI
==================================================

SaleListing edit/card should allow selecting PropertyPhoto for sale and ordering them.

Reuse LongTerm photo UX/code where possible.

Do not copy-paste large duplicated components if a small reusable abstraction is practical.

Avoid risky refactor of working LongTerm code solely for DRY.

==================================================
39. NO PUBLICATION YET
==================================================

DO NOT create:

SalePublication
Avito sale adapter
CIAN sale serializer
Domclick sale serializer
sale XML
sale feed
publish buttons

Marketplace publication is a later stage.

==================================================
40. TESTS — COMPACT BUT SERIOUS
==================================================

Do not create dozens of trivial tests.

Add focused tests covering at least:

SALE LISTING
- one SaleListing per Property
- independent from LongTermListing
- archive behavior

BUYER
- create/update/search

INTEREST
- unique buyer+listing
- FSM valid transition
- invalid terminal transition

VIEWING
- schedule
- complete
- cancel/no-show does not imply refusal

DEPOSIT
- amount > 0
- PAID → DEPOSIT_PAID
- second active paid deposit for same SaleListing → 409

PURCHASE
- purchase → BuyerInterest PURCHASED + SaleListing SOLD atomically
- second buyer cannot purchase SOLD listing
- other active interests preserved and moved to REFUSED
- history written

SECURITY
- strict schemas
- relationship/IDOR checks

REGRESSION
- Booking
- Dashboard
- Avito short-term
- LongTerm
- Publication
- CIAN feed/serializer

==================================================
41. SEED
==================================================

Extend seed with minimal deterministic Sales demo data.

Do NOT create huge fake dataset.

Enough to visually test:

- 2 SaleListings
- 2–3 Buyers
- several BuyerInterests
- at least one Viewing
- optionally one safe non-conflicting deposit

Seed must remain idempotent.

Do not seed a SOLD workflow if it complicates repeated seed.

==================================================
42. MIGRATION
==================================================

Create one Stage 9 migration where practical.

No migrate reset.

Existing DB data must survive.

After migration verify status.

==================================================
43. CHECKS
==================================================

Run ONCE at the end:

npm run lint
npx tsc --noEmit
npm test
npm run build
npm run prisma:seed

Do not run long-lived next dev/browser smoke unless needed to diagnose an actual error.

==================================================
44. ACCEPTANCE
==================================================

At completion this workflow must work:

Existing Property
   ↓
Add to Sales
   ↓
SaleListing
   ↓
Add/link Buyer
   ↓
BuyerInterest
   ↓
Schedule Viewing
   ↓
Complete Viewing
   ↓
Record Deposit
   ↓
Mark Deposit PAID
   ↓
Complete Purchase
   ↓
BuyerInterest = PURCHASED
SaleListing = SOLD
History preserved

Alternative:

BuyerInterest
   ↓
REFUSED

And one Buyer may simultaneously be interested in multiple SaleListings.

==================================================
45. REGRESSION BOUNDARY
==================================================

Must remain unchanged:

Short-term Dashboard behavior
Booking occupancy
Guest
ChannelListing
Avito short-term
LongTermListing behavior
CIAN long-term serializer/feed
Publication lifecycle

==================================================
46. DOCUMENTATION
==================================================

Create ONE document only:

docs/stage-9-sales-crm-core.md

Keep it concise.

Document:
- models
- relationships
- status/FSM
- transaction invariants
- purchase workflow
- deposit policy
- history
- API
- UI routes
- known limitations
- future SalePublication boundary

Do not repeat old project documentation.

==================================================
47. FINAL REPORT — SHORT
==================================================

Do not write a huge report.

Return:

# STAGE 9 FINAL REPORT

Schema:
- models:
- enums:
- migration:

Implemented:
- SaleListing:
- Buyers:
- Interests:
- Viewings:
- Deposits:
- Purchase:
- History:
- Photos:
- UI:

Critical invariants:
- one SaleListing/property:
- one interest/buyer+listing:
- paid deposit conflict:
- purchase atomic:
- terminal FSM:

Routes:
...

Seed:
...

Tests:
X/X PASS

Checks:
lint / tsc / tests / build / seed

Regression:
Short-term: PASS
Avito: PASS
LongTerm: PASS
CIAN: PASS
Publication: PASS

Scope:
Sale marketplace publication: NONE
Short-term Dashboard changed: NO
ChannelListing changed: NO

Known limitations:
(max 5 short bullets)

Status:
READY / PARTIAL / BLOCKED

Recommended next stage:
ONE paragraph only.

DO NOT implement next stage.