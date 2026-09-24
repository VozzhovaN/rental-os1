# Rental OS — Production Readiness Checklist (Stage 13)

Status legend: ✅ done in code · ⚠️ decision/infra required · ⛔ blocker

This checklist distinguishes three separate states (do not conflate them):

- **CODE READY** — the application code is production-safe.
- **INFRASTRUCTURE** — hosting/DB/storage/monitoring decisions the operator owns.
- **PRODUCTION RELEASE** — actually live; gated on both of the above.

---

## A. Security (code)

- [x] Argon2id password hashing, per-user salt ✅
- [x] Session tokens random; only `sha256(SESSION_SECRET:token)` stored ✅
- [x] Session fixation prevented (prior session revoked on login) ✅
- [x] Inactive-user sessions rejected ✅
- [x] Cookies `HttpOnly` + `Secure` (prod) + `SameSite=Lax` + `Path=/` ✅
- [x] Bounded login rate limiter (IP + email) ✅
- [x] Every API route classified; default AUTH_REQUIRED; registry test enforced ✅
- [x] CSRF Origin/Referer vs `APP_ORIGIN`; **fails closed in prod** if unset ✅
- [x] Integration tokens AES-256-GCM at rest (`enc:v1:`); prod fail-closed decrypt ✅
- [x] Secrets env-only; none via `NEXT_PUBLIC_*`; `.env` git-ignored ✅
- [x] Zod `.strict()` on mutating schemas (mass-assignment defense) ✅
- [x] Upload magic-byte validation + re-encode + UUID keys + traversal guard ✅
- [x] Upload per-request (10) and per-property (60) limits ✅
- [x] SSRF guards (Avito host allowlist, CIAN private-range reject, local-only PDF) ✅
- [x] No `dangerouslySetInnerHTML`; XML feeds escaped, no XXE, no PII ✅
- [x] Public routes wrapped — generic 500, no stack/Prisma leak ✅
- [x] Security headers + CSP (no `unsafe-eval` in prod) ✅
- [x] Secret redaction in logs ✅

## B. Environment (per deployment)

- [ ] `NODE_ENV=production` ⚠️
- [ ] `SESSION_SECRET` ≥ 32 chars, unique ⚠️
- [ ] `INTEGRATION_ENCRYPTION_KEY` ≥ 32 chars, unique ⚠️
- [ ] `APP_ORIGIN` set to canonical `https://…` ⚠️
- [ ] `DATABASE_URL` → production DB ⚠️
- [ ] `ADMIN_EMAIL` / `ADMIN_PASSWORD` (≥ 12), rotated after first login ⚠️
- [ ] Provider creds (`CIAN_*`, `AVITO_*`) only if used ⚠️

## C. Infrastructure (decisions required)

- [ ] `PRODUCTION_DATABASE_DECISION_REQUIRED` (SQLite vs managed) ⚠️
- [ ] `PRODUCTION_PHOTO_STORAGE_DECISION` (persistent volume vs object storage; **not** ephemeral FS) ⚠️
- [ ] `DEPLOYMENT_PROVIDER_DECISION_REQUIRED` ⚠️
- [ ] `PRODUCTION_MONITORING_PROVIDER_DECISION` ⚠️
- [ ] `DATA_RETENTION_POLICY_REQUIRED` (guest/buyer PII, integration logs) ⚠️
- [ ] `RPO_RTO_RELEASE_DECISION` ⚠️
- [ ] `SINGLE_TENANT_AUTHORIZATION_MODEL` acknowledged (trusted staff only) ⚠️
- [ ] Reverse proxy / TLS in front; trusted `X-Forwarded-*` (`XFF_TRUST`) ⚠️

## D. Data protection & backup

- [ ] Backups cover **DB + photo storage together** (`BACKUP_RESTORE.md`) ⚠️
- [ ] Restore drill executed into staging; RTO measured ⚠️
- [ ] Encryption-key rotation procedure understood ⚠️

## E. Release gate (must all pass; record outputs)

- [x] `prisma validate` ✅
- [x] `tsc --noEmit` ✅
- [x] `npm run lint` ✅
- [x] `npm test` (296 pass / 0 fail) ✅
- [x] `npm run build` ✅
- [x] `npm audit` reviewed — 0 critical; 3 high in Prisma dev-tooling chain (`PRISMA_DEEPMERGE_ADVISORY`), not in request path; major-upgrade deferred ✅
- [ ] Deploy against a **staging** environment first ⚠️
- [ ] `/api/health` returns 200 in the target environment ⚠️
- [ ] Rollback path validated (`DEPLOYMENT.md` §7) ⚠️

---

## Overall readiness

| Dimension | State |
| --- | --- |
| **CODE READY** | ✅ Ready (0 critical / 0 high code findings; MEDIUM fixed; LOW fixed or accepted) |
| **INFRASTRUCTURE** | ⚠️ Decisions required (DB, storage, hosting, monitoring, retention, RPO/RTO) |
| **PRODUCTION RELEASE** | ⛔ Not ready until Sections B–E are satisfied by the operator |
