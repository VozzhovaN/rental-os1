# Stage 11.1 — CRM Authentication Foundation

## Models

- **User** — internal CRM account (`email` unique/normalized, `passwordHash`, `isActive`, optional `name` / `lastLoginAt`)
- **Session** — server-side session (`tokenHash` unique, `expiresAt`, optional `userAgent` / `ipHash`)

Raw session tokens are never stored. Cookie carries an opaque random token; DB stores `sha256(SESSION_SECRET:token)`.

## Password hashing

**Argon2id** via `argon2` package.

Minimum password length for bootstrap/admin: **12** characters (no symbol/case rules). Passwords are never trimmed.

## Cookie

- Name: `rental_os_session`
- HttpOnly, SameSite=Lax, Path=/
- Secure=true in production
- TTL: 7 days (override `SESSION_TTL_DAYS`)

## Route classification

| Class | Paths |
|---|---|
| PUBLIC | `/api/auth/login`, `/api/feeds/cian/long-term.xml`, `/api/feeds/cian/sale.xml` |
| EXTERNAL_INTEGRATION | `/api/integrations/avito/callback` |
| AUTH_OPTIONAL | `/api/auth/logout` (idempotent) |
| AUTH_REQUIRED | all other `/api/*`, CRM UI via layout + proxy |

## CSRF

SameSite=Lax + Origin/Referer host check on mutating AUTH_REQUIRED (and logout when cookie present). Not applied to Avito OAuth callback.

## Rate limiting

In-memory per IP + normalized email (10 / 15 min). **Not shared across processes** — document for multi-instance production.

## Bootstrap

`ADMIN_EMAIL` + `ADMIN_PASSWORD` in seed. Idempotent: existing user password is never overwritten. Production with zero users and missing env fails safely.

## Known limitations

- No RBAC / password reset / OAuth / 2FA
- Proxy performs optimistic cookie presence checks; full session validation is in CRM layout + `requireAuth` / `/api/auth/me`
- In-memory login rate limit is per-process
