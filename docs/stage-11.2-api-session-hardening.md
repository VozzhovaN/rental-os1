# Stage 11.2 — API Authorization + Session Hardening

## Route classification

Central registry: `lib/auth/api-registry.ts` (every `app/api/**/route.ts`).

| Access | Routes |
|---|---|
| PUBLIC | `POST /api/auth/login`, CIAN LT + sale feeds |
| EXTERNAL_INTEGRATION | `GET /api/integrations/avito/callback` |
| AUTH_OPTIONAL | `POST /api/auth/logout` |
| AUTH_REQUIRED | all other `/api/*` (default-secure) |

Classification test fails if a new `route.ts` is not registered.

## Full session validation

Canonical path: `withApiAuth` → `enforceApiAccess` → `requireAuth` / `getSessionByRawToken`.

Checks: cookie → token hash → DB session → not expired → User exists → `isActive`.

Proxy remains an optimistic cookie/CSRF gate only.

## CSRF

SameSite=Lax + Origin/Referer vs **APP_ORIGIN** (scheme+host) when set.
Required in production. Dev may omit and fall back to Host-derived origin.

Applied centrally inside `enforceApiAccess` for mutating AUTH_REQUIRED (and logout when cookie present).

## Session lifecycle

- Fixed TTL (default 7 days); no per-request rotation
- Login: revoke prior cookie session, create fresh random token (anti-fixation)
- `lastUsedAt`: throttled (~20 min)
- `cleanupExpiredSessions()` lazy on session create
- Inactive users fail validation immediately (401)

## Cookie

`rental_os_session`: HttpOnly, SameSite=Lax, Path=/, Secure in production, **host-only** (no Domain). Logout clears with same attributes.

## Rate limit

In-memory, bounded, expiry prune. `MULTI_INSTANCE_RATE_LIMIT = PRODUCTION_HARDENING_PENDING`.

## External callbacks

Avito OAuth callback: state cookie check only.  
`EXTERNAL_CALLBACK_AUTH = BLOCKED_BY_PROVIDER_CONFIRMATION` (no provider crypto signature available).

## Cache

Protected handlers via `withApiAuth` set `Cache-Control: no-store`.
