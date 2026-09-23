# Stage 8.2.1 — Implementation Readiness

**Access date:** 2026-09-21  
**Code freeze respected:** documentation only.

---

## 1. Readiness classification

| Provider | Flags | IMPLEMENTATION CONTRACT READY? |
|---|---|---|
| **CIAN** | `PROVIDER_CONFIRMATION_REQUIRED` (unpublish) + `ACCOUNT_ACCESS_REQUIRED` (live XSD/docs/API) + later `READY_AFTER_INTERNAL_GAPS` (floor, phone, photos) | **NO** — **BLOCKED WITH EXACT REASON** |
| **AVITO** | `ACCOUNT_ACCESS_REQUIRED` + `DOCUMENTATION_BLOCKED` (realty Autoload template + unpublish FAQ) + later `READY_AFTER_INTERNAL_GAPS` | **NO** — **BLOCKED WITH EXACT REASON** |
| **DOMCLICK** | `DOCUMENTATION_BLOCKED` + `ACCOUNT_ACCESS_REQUIRED` / `PARTNER_ACCOUNT_REQUIRED` + `SUPPORT_REQUEST_REQUIRED` | **NO** — **BLOCKED WITH EXACT REASON** |

Ideal aspirational outcome from the Stage brief (READY_AFTER_INTERNAL_GAPS for CIAN) is **not met**: live CIAN unpublish + live schema were not obtained without captcha/account.

---

## 2. Which provider can safely be implemented first?

**None** for production publish/unpublish in Stage 8.2.

**Ordering when blockers clear:**

1. **CIAN** — still first candidate: XML write path CONFIRMED; archived field inventory richest; blockers are access + unpublish confirmation + internal floor/phone/photos.
2. **Avito** — second: transport CONFIRMED; apartment LT template missing.
3. **Domclick** — last: LT schema absent.

**Do not start Stage 8.2 implementation now.**

---

## 3. Exact next stage recommendation

**Stage 8.2.2 — Authorized documentation capture (human / partner account)**

Deliverables (docs only or securely attached official exports):

1. CIAN: live `flatRent` XSD + HelpDesk unpublish article + import report API method list under ACCESS KEY.
2. Avito: logged-in Autoload realty template «Квартиры / Сдам» + FAQ unpublish + Autoload scopes.
3. Domclick: PRO-authenticated validation/schema for secondary long-term rent **or** written support answer that it is unavailable.

After 8.2.2, re-run contract freeze; only then Stage **8.2** serializers/feeds.

---

## 4. Feed ownership / batch semantics

| Provider | Ownership model | Evidence |
|---|---|---|
| CIAN | **One feed per account/provider** containing many `object` nodes (archived schema `object` unbounded) | archived XSD |
| Avito | **One Autoload profile / feeds_data set per account**; file contains many ads | business Autoload + OpenAPI profile |
| Domclick | UNKNOWN | blocked |

**Unpublish interaction:** removing one object/ad from a shared feed is the **candidate** mechanism for Avito/CIAN, but CIAN unpublish official effect is **BLOCKED_BY_PROVIDER_CONFIRMATION**; Avito FAQ unread → **BLOCKED**.

### Error isolation

| Question | CIAN | Avito | Domclick |
|---|---|---|---|
| Can one invalid object fail alone? | **UNKNOWN** live (import report historically per ExternalId) | Autoload reports expose per-Id statuses (OpenAPI mirror) — **PARTIAL** | UNKNOWN |
| Can entire upload fail? | **UNKNOWN** | Possible for malformed file — **PARTIAL** | UNKNOWN |

**Publication isolation requirement:** one Publication ERROR must not flip another Publication’s status in CRM.  
Feed batching does **not** remove that rule: map per-item report rows to the matching Publication only; unknown batch failure → mark only Publications present in failed upload set, or hold all in PUBLISHING until report — **decision deferred** until live report contracts exist. Do not invent.

---

## 5. Update detection ADR (no implementation)

Stage 8.1: no Publication snapshot.

| Option | Verdict |
|---|---|
| A `LongTermListing.updatedAt` | Reject as sole signal — false positives on non-serialized fields |
| **B serialized payload hash** | **Recommended** |
| C publication version counter | Acceptable alternative if writers always bump |
| D other | — |

**Decision: B — canonical hash of NormalizedLongTermPublicationData (per provider serializer input).**

On LT/property/photo change: recompute hash; if differs from `Publication.lastSerializedHash` (future field) and status is PUBLISHED → emit START_UPDATE → UPDATE_PENDING.

**Do not implement hash storage in 8.2.1** (would be Prisma change → STOP). Record as proposed change only.

---

## 6. FSM compatibility (enum unchanged)

| Gap | Description |
|---|---|
| FSM_GAP moderation | Provider rejected/moderation-pending without distinct status → use ERROR + `externalStatus` |
| FSM_GAP CIAN unpublish | Cannot map UNPUBLISHING→UNPUBLISHED |
| FSM_GAP Avito unpublish | Same until FAQ |
| Fake success | Still forbidden: PUBLISHING→PUBLISHED only on report/item evidence |

---

## 7. Normalized DTO recommendation

See `docs/stage-8.2.1-crm-publication-gaps.md` §10.  
Introduce NormalizedLongTermPublicationData in a **later coding stage**, not 8.2.1.

---

## 8. Required future schema changes (proposed only)

| Change | Trigger |
|---|---|
| Non-null floor policy or DB constraint for CIAN-bound listings | CIAN FloorNumber |
| Structured publication phone / country code | CIAN Phones |
| commission role / split fees | CIAN ClientFee vs AgentFee |
| `lastSerializedHash` (and optionally `clientExternalId`) on Publication | update detection / feed id clarity |
| Photo public URL strategy (storage outside Prisma or absolute URL validation) | photo contract |

**No migrations in this stage.**

---

## 9. Checks expectation

Run after docs:

- `npm run lint`
- `npx tsc --noEmit`
- `npm test` (baseline ≥ 62/62)
- `npm run build`
- `npm run prisma:seed`

Expected git diff: only the four Stage 8.2.1 markdown files.
