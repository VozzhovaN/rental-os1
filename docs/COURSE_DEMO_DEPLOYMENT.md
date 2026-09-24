# Rental OS — Course Demo Deployment (Stage 14)

A safe, self-contained **demonstration** deployment for defending the course
project. It is **not** a production release (see `PRODUCTION_CHECKLIST.md`).

- All data is **artificial** (demo seed). No real guests / owners / buyers.
- No real Avito / CIAN / Domclick credentials.
- Runs with the **same security model** as production (`NODE_ENV=production`).
- `DEMO_MODE=true` only enables a banner and the demo reset guard — it never
  weakens auth, CSRF, validation, FSM, or finance rules.

> `COURSE_DEMO_SQLITE_ONLY`: for this limited course demo, SQLite is acceptable
> **provided it lives on a persistent volume**. This is a demo-only decision and
> does **not** make SQLite the production architecture of Rental OS. The
> Stage 13 `PRODUCTION_DATABASE_DECISION_REQUIRED` remains open.
>
> `COURSE_DEMO_SINGLE_ADMIN_MODEL`: the demo teacher account uses the existing
> single-admin access. No RBAC is added for the demo.

---

## 1. Prerequisites

- A **private** Git repository containing this project.
- A Railway account (free/hobby is enough for a temporary demo).
- Credentials for the demo admin, chosen at deploy time (never committed).

---

## 2. Environment matrix

Set these as Railway **service variables** (secrets are never committed):

| Variable | Required | Secret | Example / format | Purpose |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | ✅ | no | `production` | Enables prod security (secure cookies, strict CSP, fail-closed checks). Required even for the demo. |
| `DEMO_MODE` | ✅ | no | `true` | Demo banner + enables `demo:reset` guard. Not a security bypass. |
| `DATABASE_URL` | ✅ | no | `file:/data/demo.db` | SQLite file **on the persistent volume**. Name must contain `demo` for reset safety. |
| `PHOTO_STORAGE_ROOT` | ✅ | no | `/data/storage` | Uploaded photo bytes on the persistent volume (survives redeploys). |
| `SESSION_SECRET` | ✅ | **yes** | ≥ 32 random chars | Session pepper. Unique to the demo; not the local/prod value. |
| `INTEGRATION_ENCRYPTION_KEY` | ✅ | **yes** | ≥ 32 random chars | AES-256-GCM key. Unique to the demo. |
| `APP_ORIGIN` | ✅ | no | `https://<app>.up.railway.app` | Canonical HTTPS origin (CSRF fails closed without it). Set **after** the domain is known. |
| `ADMIN_EMAIL` | ✅ | no | `teacher@demo.local` | Bootstrap admin (demo teacher login). |
| `ADMIN_PASSWORD` | ✅ | **yes** | ≥ 12 chars | Bootstrap admin password. Set only in Railway; never in Git/README. |
| `SESSION_TTL_DAYS` | optional | no | `7` | Session lifetime. |

Generate strong secrets locally, e.g.:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Do **not** set any Avito/CIAN/Domclick credentials for the demo.

---

## 3. Deployment steps (Railway)

Railway is **not** connected as part of Stage 14 — this is the runbook to do it.

1. **Create a Railway project** and a service from the **private GitHub repo**.
2. **Add a persistent volume** and mount it (e.g. at `/data`). All durable state
   lives here: `DATABASE_URL=file:/data/demo.db` and `PHOTO_STORAGE_ROOT=/data/storage`.
3. **Set environment variables** from the matrix above (leave `APP_ORIGIN` for now).
4. Railway auto-detects Next.js from `package.json`:
   - Build: `npm run build`
   - Start: `npm run start` (Next binds the platform `PORT` automatically).
   - Health check path: `/api/health`.
5. **Apply the database schema** (one-off, on the volume):
   `npx prisma migrate deploy`
   (run as a deploy/release command or a one-off shell — never `migrate reset` on normal startup).
6. **Load the demo data** (one-off):
   `npm run demo:seed`
7. **Get the Railway domain** (e.g. `https://<app>.up.railway.app`).
8. **Set `APP_ORIGIN`** to that exact HTTPS URL.
9. **Redeploy** so `APP_ORIGIN` takes effect.
10. **Verify** `GET /api/health` → `200 {"status":"ok"}`.
11. **Log in** with the demo admin credentials.
12. **Smoke test** (see §5).

> Normal restarts/redeploys must **not** reseed. Persistent demo data lives on the
> volume; startup only applies migrations, then the app starts.

---

## 4. Demo reset / reseed

Teachers can create/edit/cancel data. To restore the original dataset, the
**operator** runs (in a Railway shell for the service, or locally against the
demo DB):

```bash
npm run demo:reset
```

This is fail-closed (`scripts/demo-reset.ts` → `assertDemoResetAllowed`):
- refuses unless `DEMO_MODE=true`,
- refuses unless `DATABASE_URL` is a SQLite `file:` DB whose name contains `demo`,
- explicitly refuses `dev.db`.

It then recreates the schema on the demo DB and reloads the demo seed. There is
**no** public reset endpoint.

For a lightweight backup, copy the demo DB + `PHOTO_STORAGE_ROOT` together (see
`BACKUP_RESTORE.md`). This does not replace the Stage 13 production backup plan.

---

## 5. Smoke test checklist

Functional: login → Dashboard (populated) → Object + photos → Guest → Booking →
Calendar (past/current/future) → Owner → Long-term → Sales → Presentation
(published public link + PDF) → Finance → Settings/Integrations → logout.

Security:
- Protected API without a session → `401`.
- DRAFT presentation public link → unavailable; PUBLISHED → available.
- No secrets in client bundle / responses.
- Invalid photo upload → rejected.
- CSRF enforced against the configured `APP_ORIGIN`.
- `/api/health` exposes no sensitive data.

---

## 6. Known demo limitations

- `DEMO_PHOTO_ASSETS_REQUIRED`: no real photos are shipped. The demo runs without
  images (upload flow still works). Add neutral placeholder assets if desired;
  do not download random internet images.
- SQLite on a single volume — no HA/SLA. Persistent volume is mandatory so data
  survives restarts.
- Single-admin model (`COURSE_DEMO_SINGLE_ADMIN_MODEL`).
- Not a production release — infrastructure decisions in `PRODUCTION_CHECKLIST.md`
  are still open.
