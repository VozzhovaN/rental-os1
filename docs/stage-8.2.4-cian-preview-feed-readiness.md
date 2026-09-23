# Stage 8.2.4 — CIAN Preview & Feed Readiness

Локальный CIAN-контур: диагностика, preview/download XML, hashes, batch feed. Без сети и без мутации Publication.

## Pipeline

```
LongTermListing
→ buildNormalizedLongTermPublicationData()
→ validateLongTermPublicationReadiness()
→ validateCianFlatRentPublication()
→ mapToCianFlatRentPayload()
→ serializeCianFeed([payload])
→ CRM preview / download
```

Multi:

```
listings[] → prepareCianFeed() → { validItems, invalidItems, warnings, xml }
```

## Diagnostics (CRM)

`/crm/long-term/[id]` — блок «ЦИАН — диагностика»:

- baseline readiness
- CIAN validation
- errors / warnings
- `READY FOR CIAN XML` | `NOT READY FOR CIAN XML`
- `normalizedHash` / `cianPayloadHash` (короткий префикс; не в БД)

Не утверждает «опубликовано».

## Preview / download

- Service: `buildCianListingPreview(listing)`
- API: `GET /api/long-term-listings/:id/publications/cian/preview`
  - 422 + structured errors, `xml: null` при ошибках
  - 200 JSON `{ xml, hashes, … }` при успехе
  - `?download=1` → `application/xml`, `cian-{listingId}.xml`
- Данные только из DB → builders. Клиентский XML не принимается.

## Hashes

- `normalizedHash` = Stage 8.2.2 SHA-256
- `cianPayloadHash` = SHA-256 canonical CIAN payload
- Persistence: **NONE**

## Batch / feed

- `prepareCianFeed(listings)` — isolation + XML feed
- Diagnostic: `GET /api/crm/cian-feed-preview?ids=id1,id2` (max 50)
- Нет публичного feed URL

## Security

- Только CRM API routes
- Телефон не логируется
- XML в UI через React text (`<pre>{xml}</pre>`)
- Filename детерминированный, без path params

## Until real CIAN

1. Live XSD / unpublish contract
2. Credentials + registered feed URL
3. Publication FSM + HTTP/report sync
4. BedsCount / Currency live confirmation
