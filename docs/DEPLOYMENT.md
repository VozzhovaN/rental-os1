# Rental OS — Deployment Guide (Stage 13)

Provider-neutral deployment guidance for Rental OS v1.0 (Next.js 16 App Router +
Prisma 6). This document describes **how** to deploy safely and the
**infrastructure decisions** that must be made first. It does **not** provision,
purchase, or connect anything.

---

## 0. Stack summary

- Next.js 16 (App Router, standalone server via `next build` / `next start`).
- Node.js server runtime (native deps: `argon2`, `sharp`, `@prisma/client` —
  declared in `serverExternalPackages`).
- Prisma 6 + SQLite in dev. Production DB = decision required.
- Local filesystem photo storage in dev. Production storage = decision required.

---

## 1. Infrastructure decisions (REQUIRED before go-live)

| ID | Decision |
| --- | --- |
| `PRODUCTION_DATABASE_DECISION_REQUIRED` | Keep SQLite (single small instance, file backups) **or** move to a managed engine (Postgres-class) for durability, PITR, and multi-instance. |
| `PRODUCTION_PHOTO_STORAGE_DECISION` | Keep a persistent server volume for `storage/` **or** move to object storage. Ephemeral container FS is **not** acceptable — photos would be lost on redeploy. |
| `DEPLOYMENT_PROVIDER_DECISION_REQUIRED` | Choose hosting (VM / container platform / PaaS). Must support a long-lived Node server, persistent volume (if file storage), and env-var secrets. |
| `PRODUCTION_MONITORING_PROVIDER_DECISION` | Choose logging/metrics/alerting destination. |
| `DATA_RETENTION_POLICY_REQUIRED` | Define retention/erasure for guest/buyer personal data (PII) and integration logs. |
| `SINGLE_TENANT_AUTHORIZATION_MODEL` | Confirm the CRM is only exposed to trusted staff (no per-record RBAC in v1.0). |
| `RPO_RTO_RELEASE_DECISION` | Commit backup RPO/RTO targets (see `BACKUP_RESTORE.md`). |

---

## 2. Required environment variables (production)

Set as platform secrets — **never** commit. See `.env.example` for the full list.

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV=production` | ✅ | Enables secure cookies, strict CSP, fail-closed checks |
| `DATABASE_URL` | ✅ | Points at the production DB |
| `SESSION_SECRET` | ✅ | ≥ 32 chars, random, unique |
| `INTEGRATION_ENCRYPTION_KEY` | ✅ | ≥ 32 chars, random, unique |
| `APP_ORIGIN` | ✅ | Canonical `https://…` origin (CSRF fails closed without it) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | ✅ (bootstrap) | Password ≥ 12; rotate after first login |
| `SESSION_TTL_DAYS` | optional | Default 7 |
| `CIAN_ACCESS_KEY` / `CIAN_FEED_BASE_URL` / `CIAN_ACCOUNT_ID` | optional | CIAN feeds |
| `AVITO_CLIENT_ID` / `AVITO_CLIENT_SECRET` | optional | Avito OAuth |

The app **refuses to start / operate** in production without the secret minimums
(enforced in `lib/auth/env.ts`, `lib/integrations/crypto.ts`).

---

## 3. Build & run

```bash
npm ci
npx prisma generate
# Apply schema to the production database (choose one):
#   - SQLite / first deploy:      npx prisma migrate deploy
#   - Managed DB:                 npx prisma migrate deploy
npm run build
npm run start        # next start — long-lived Node server
```

- Do **not** run `prisma migrate dev`, `migrate reset`, or `db push` against
  production — they can drop data. Use `prisma migrate deploy` only.
- The admin bootstrap runs from `ADMIN_EMAIL`/`ADMIN_PASSWORD` on first startup;
  it does **not** overwrite an existing admin password.

---

## 4. Reverse proxy / TLS

- Terminate TLS at a proxy or the platform edge; forward to the Node server.
- The app trusts `X-Forwarded-Proto` and `X-Forwarded-For`
  (`XFF_TRUST`, LOW): only deploy behind a **trusted** proxy that sets these
  headers, otherwise rate-limit keys and origin scheme can be spoofed.
- Ensure `APP_ORIGIN` exactly matches the public origin (scheme + host).

---

## 5. Health check

`GET /api/health` → `200 {"status":"ok"}`, `Cache-Control: no-store`, no
sensitive details. Use it for the platform liveness/readiness probe.

---

## 6. Scaling decisions

The session cache and login rate limiter are **in-process** (per instance).
Running more than one instance without changes means:

- Rate limiting is per-instance (weaker global protection).
- No cross-instance session cache invalidation issues (sessions live in the DB),
  but sticky routing is not required.

For real horizontal scale, introduce a shared store (e.g. Redis) — this is a
**deployment decision**, intentionally not added in v1.0 (no new runtime deps
without a deployment decision).

---

## 7. Rollback

1. Keep the previous build/image and the previous migration state recorded.
2. **Code-only rollback** (no new migration): redeploy the previous build.
3. **Rollback across a migration**: restore the DB from the pre-migration backup
   (`BACKUP_RESTORE.md`) *and* redeploy the matching previous build. Never leave
   a newer schema with older code or vice versa.
4. Prefer **forward-fix** for data-affecting issues over destructive down-migrations.
5. After any rollback, re-verify `/api/health` and a login.

---

## 8. Pre-deploy gate

Run and record all of: `npx prisma validate`, `npm run lint`,
`npx tsc --noEmit`, `npm test`, `npm run build`, `npm audit`. See
`PRODUCTION_CHECKLIST.md` for the full gate.
