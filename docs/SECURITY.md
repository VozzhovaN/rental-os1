# Rental OS — Security Overview (Stage 13)

This document describes the security model of Rental OS v1.0 as implemented in
code. It is provider-neutral and contains **no real secret values**. Rotate any
value that ever appears in a log, screenshot, or chat.

---

## 1. Authentication & Sessions

| Control | Implementation |
| --- | --- |
| Password hashing | Argon2id (`argon2`), per-user salt (`lib/auth/password.ts`) |
| Password policy | Bootstrap admin password ≥ 12 chars (`assertAdminPasswordPolicy`) |
| Session token | `randomBytes(32)` random, never client-supplied |
| Session storage | DB stores `sha256(SESSION_SECRET : token)` — raw token never persisted |
| Session pepper | `SESSION_SECRET` (min 32 chars in production, enforced) |
| Session fixation | Prior cookie session revoked on login (`revokeSessionByRawToken`) |
| Inactive users | Sessions for `isActive = false` users are rejected |
| Session TTL | `SESSION_TTL_DAYS` (default 7) |
| Rate limiting | Bounded in-memory limiter per IP + per email (`lib/auth/rate-limit.ts`) |

**Cookie flags** (`lib/auth/cookies.ts`): `HttpOnly`, `Secure` (production),
`SameSite=Lax`, `Path=/`.

> The in-memory rate limiter and session cache are per-process. A multi-instance
> deployment needs a shared store — see `DEPLOYMENT.md` → *Scaling decisions*.

---

## 2. API Authorization

- Every `app/api/**/route.ts` file is classified in `lib/auth/api-registry.ts`.
  A test (`security-hardening.test.ts`) fails the build if any route file is
  unregistered or the counts drift.
- Default is **AUTH_REQUIRED**. Only explicitly listed routes are `PUBLIC`,
  `EXTERNAL_INTEGRATION`, or `AUTH_OPTIONAL`.
- Public routes: `/api/health`, `/api/auth/login`, `/api/feeds/cian/*.xml`,
  `/api/p/[token]`, `/api/p/[token]/pdf`, `/api/p/[token]/photos/[photoId]`.
- External: `/api/integrations/avito/callback` (OAuth redirect).

### Authorization model (single-tenant)

Rental OS v1.0 is a **single-organization** CRM: any authenticated user can act
on all business data. There is no per-record ownership / RBAC. This is an
accepted product decision for v1.0 — see `SINGLE_TENANT_AUTHORIZATION_MODEL` in
`PRODUCTION_CHECKLIST.md`. Do not expose the CRM to untrusted users under this
model.

---

## 3. CSRF / Origin Protection

`lib/auth/csrf.ts` validates `Origin` / `Referer` against the canonical
`APP_ORIGIN` for mutating authenticated calls; `SameSite=Lax` is defense in
depth. In **production**, if `APP_ORIGIN` is unset the check now **fails closed**
(throws) rather than trusting the spoofable `Host` header.

---

## 4. Secrets & Encryption

| Secret | Where | Notes |
| --- | --- | --- |
| `SESSION_SECRET` | env only | min 32 chars in prod (enforced) |
| `INTEGRATION_ENCRYPTION_KEY` | env only | AES-256-GCM key material; min 32 chars in prod |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | env only, bootstrap | password ≥ 12 |
| `APP_ORIGIN` | env only | required in prod |
| `CIAN_*`, `AVITO_*` | env only | optional; per-integration |

- Integration tokens are encrypted at rest with **AES-256-GCM** (unique IV, auth
  tag, `enc:v1:` version prefix). `decryptSecret` **fails closed** in production
  for any value lacking the prefix.
- `redactSecrets()` scrubs tokens, cookies, and known secret keys from logs.
- Integration DTOs never return `accessToken` / `refreshToken` / ciphertext
  (`serializeConnectionPublic`).
- **No secret is exposed via `NEXT_PUBLIC_*`.** Verified: no `NEXT_PUBLIC_`
  variables reference auth/integration secrets.
- `.env` is git-ignored (`.env*` with `!.env.example`); only `.env.example`
  (empty placeholders) is tracked.

---

## 5. File & Photo Upload Security

- Magic-byte validation (JPEG/PNG/WEBP) — extension/`Content-Type` not trusted
  (`lib/property-photo-process.ts`).
- Re-encoded via `sharp`; UUID storage keys; `assertSafeStorageKey` blocks path
  traversal.
- Per-request limit: **10 files** (`MAX_PHOTOS_PER_UPLOAD`).
- Per-property limit: **60 photos** (`MAX_PHOTOS_PER_PROPERTY`).
- Body size capped at 32 MB (`next.config.ts` proxy limit).

---

## 6. SSRF / Outbound Requests

- Avito API calls restricted to an allowlisted host (`resolveAvitoApiUrl`
  rejects arbitrary/host-spoofed URLs, incl. link-local metadata IPs).
- CIAN photo URLs rejecting private/link-local ranges.
- PDF renderer operates on local data only.

---

## 7. Output Safety (XSS / Injection)

- React auto-escaping; **no `dangerouslySetInnerHTML`** in the codebase.
- CIAN XML feeds use `escapeXml`; no DOCTYPE/ENTITY (XXE) emitted; feeds contain
  no Buyer/Guest/session/secret data.
- Public routes wrap handlers (`withPublicRoute`) so unexpected exceptions return
  a generic 500 with no stack / Prisma internals.

---

## 8. Security Headers / CSP

Applied to all responses via `next.config.ts`:

- `Content-Security-Policy`: `default-src 'self'`, `object-src 'none'`,
  `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`.
  `unsafe-eval` is **development only**. `unsafe-inline` remains on
  `script-src`/`style-src` — documented App Router / Tailwind tradeoff
  (`CSP_UNSAFE_INLINE_TRADEOFF`).
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
  disabling camera/mic/geo/payment/usb.

---

## 9. Known Residual Items (accepted for v1.0)

| ID | Severity | Summary |
| --- | --- | --- |
| `CSP_UNSAFE_INLINE_TRADEOFF` | LOW | `unsafe-inline` on script/style-src (no nonces) |
| `XFF_TRUST` | LOW | `X-Forwarded-For` trusted for rate-limit keying; requires a trusted proxy in front (see DEPLOYMENT) |
| `PRISMA_DEEPMERGE_ADVISORY` | HIGH (dev-tooling) | `deepmerge-ts` stack-exhaustion via Prisma CLI/config; not in the request path. Fix = major Prisma upgrade — deferred (see below) |

`npm audit`: 0 critical, **3 high**, all from the `prisma` → `@prisma/config` →
`deepmerge-ts` **build/CLI** chain (not runtime request handling). The suggested
remediation is a **major** Prisma bump; per Stage 13 constraints this is **not**
applied automatically. Track as `PRISMA_MAJOR_UPGRADE_DECISION`.

---

## 10. Incident Response Runbook

**A. Detect / Triage.** Identify scope: which secret, data, or account. Preserve
logs (already secret-redacted). Note first/last observed timestamps.

**B. Contain.**
- Suspected session/credential theft → invalidate sessions:
  `DELETE FROM Session;` (all users must re-login) and/or set the affected user
  `isActive = false`.
- Suspected app compromise → take the instance offline / scale to zero.

**C. Rotate.** Regenerate and redeploy affected secrets:
`SESSION_SECRET` (invalidates all sessions), `INTEGRATION_ENCRYPTION_KEY` (see
BACKUP_RESTORE → key rotation), `ADMIN_PASSWORD`, and any `CIAN_*` / `AVITO_*`
provider credentials (rotate at the provider too). Never reuse an exposed value.

**D. Recover.** Restore from a known-good backup if data integrity is in doubt
(see `BACKUP_RESTORE.md`). Verify DB + photo storage restored together. Confirm
baseline (`prisma validate`, `npm test`, `npm run build`) before reopening.

**E. Review.** Root-cause writeup: what, how, blast radius, timeline. File
follow-up hardening tasks. Update this runbook.
