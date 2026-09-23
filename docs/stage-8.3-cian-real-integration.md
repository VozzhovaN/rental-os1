# Stage 8.3 — CIAN Real Integration (partial)

## Ownership

CIAN account → one public feed (`GET /api/feeds/cian/long-term.xml`) → many LongTermListings → one Publication per listing × CIAN.

## Safe subset implemented

- Public feed from ACTIVE listings with Publication in `PUBLISHING` | `UPDATE_PENDING` | `PUBLISHED`
- Prepare action: create Publication + `START_PUBLISH` → **PUBLISHING** (never fake PUBLISHED)
- `Publication.lastSerializedHash` for payload change detection → `START_UPDATE` when PUBLISHED + hash differs
- CRM diagnostics: status, readiness, included in feed, payload changed, blockers

## Env placeholders

`CIAN_ACCESS_KEY`, `CIAN_FEED_BASE_URL`, `CIAN_ACCOUNT_ID` — empty in `.env.example`; no fallback credentials.

## Blocked

- `CIAN_STATUS_SYNC = BLOCKED_BY_PROVIDER_ACCESS` (no credentials / live import-report contract in `.env`)
- `CIAN_UNPUBLISH = BLOCKED_BY_PROVIDER_CONFIRMATION` (official unpublish semantics not confirmed)
- No CIAN HTTP status/unpublish client
