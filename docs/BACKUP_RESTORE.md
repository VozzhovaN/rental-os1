# Rental OS — Backup & Restore (Stage 13)

Rental OS persists data in **two** places that must always be backed up and
restored **together**:

1. **Database** — SQLite file in development (`prisma/dev.db`). Production
   database is a **decision required** item (see `DEPLOYMENT.md`).
2. **Photo storage** — raw image bytes under `storage/properties/{propertyId}/`.
   The database only stores metadata (`PropertyPhoto.storageKey`, `url`).

> Restoring the database alone leaves broken `storageKey` references and missing
> images. Restoring photos alone leaves orphaned files. Always snapshot and
> restore both at a consistent point in time.

---

## RPO / RTO — DECISION REQUIRED

Before go-live the operator must commit to targets (`RPO_RTO_RELEASE_DECISION`):

- **RPO** (max acceptable data loss): e.g. 24h daily / 1h hourly / near-zero.
- **RTO** (max acceptable downtime to restore): e.g. < 1h.

These drive backup frequency and whether point-in-time recovery (a managed
Postgres-class DB) is needed instead of file snapshots.

---

## Backup — SQLite (development / small single-instance)

Take a **consistent** copy (do not `cp` a live SQLite file mid-write). Use the
online backup API:

```bash
# Consistent DB snapshot
sqlite3 prisma/dev.db ".backup 'backup/rental-os-$(date +%F).db'"

# Photo bytes (same timestamp)
tar -czf backup/photos-$(date +%F).tar.gz storage/properties
```

Store both artifacts in the **same dated set** off-box (object storage /
encrypted backup service). Encrypt at rest; restrict access.

---

## Restore — SQLite

```bash
# 1. Stop the app (no writers).
# 2. Restore DB.
cp backup/rental-os-YYYY-MM-DD.db prisma/dev.db

# 3. Restore photos (same dated set).
tar -xzf backup/photos-YYYY-MM-DD.tar.gz -C .

# 4. Verify.
npx prisma validate
npm test
npm run build
```

Then confirm in the app that a sample property renders its cover photo (proves
`storageKey` ↔ file consistency).

---

## Managed database (recommended for production)

If the `PRODUCTION_DATABASE_DECISION` selects a managed engine (e.g. Postgres):

- Use the provider's **automated backups + point-in-time recovery** for the DB.
- Continue backing up **photo storage** separately (object storage bucket
  versioning + lifecycle, or the `storage/` volume) at the **same cadence**.
- Test a full restore into a staging environment at least once before go-live.

---

## Encryption-key rotation (`INTEGRATION_ENCRYPTION_KEY`)

Integration tokens are AES-256-GCM encrypted with this key. Rotating it makes
existing ciphertext undecryptable (in production `decryptSecret` returns `null`
for anything it cannot read — fail-closed).

Safe rotation:

1. Announce a maintenance window.
2. Rotate the key value.
3. **Re-connect** each affected integration (Avito OAuth, CIAN keys) so tokens
   are re-encrypted under the new key. There is no silent re-encryption path.

`SESSION_SECRET` rotation invalidates all active sessions (all users re-login).

---

## Restore drill checklist

- [ ] Backup set contains **both** DB and photo artifacts, same timestamp.
- [ ] Restore performed into a clean/staging target, not production first.
- [ ] `prisma validate`, `npm test`, `npm run build` pass post-restore.
- [ ] Sample property cover photo renders.
- [ ] Restore duration measured against the committed **RTO**.
