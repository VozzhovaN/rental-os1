# Demo photos (course demo)

Disposable photo assets for the artificial demo dataset.

- Path: `storage/demo/properties/{property-slug}/`
- JPEGs in this folder are **committed** so `demo:seed` works without Unsplash
  (e.g. on Railway). Seed reuses local files when present.
- Seeded/linked by `npm run demo:seed` / `npm run demo:reset`
- Safe to delete this entire `demo/` folder together with demo DB data
- Does **not** contain real CRM uploads (those live under `storage/properties/{propertyId}/`)

Sources: Unsplash (royalty-free). Committed local copies remove the runtime/network dependency.
