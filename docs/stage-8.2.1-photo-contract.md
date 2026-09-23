# Stage 8.2.1 — Photo Contract

**Access date:** 2026-09-21  
**No storage/CDN implementation.**

---

## 1. Current CRM photo chain

```
PropertyPhoto.url
  → LongTermListingPhoto (included, sortOrder)
  → LongTermListing
  → Publication
```

| Capability | Present? |
|---|---|
| Selection / ordering | yes |
| Main photo flag | implicit (first included) |
| Absolute public HTTPS guarantee | **no** |
| Mime / dimensions / size / checksum | **no** |
| Versioned URL on binary replace | **no** |

---

## 2. Requirement matrix

| Requirement | CIAN | Avito | Domclick |
|---|---|---|---|
| Transport type | Remote URL in XML (`Photos` / `FullUrl`) — **CONFIRMED** archived XSD | Remote URL and/or ZIP patterns exist in Autoload product generally — **PARTIAL**; realty tag names **UNKNOWN** | **UNKNOWN** |
| Absolute URL required? | When emitting `FullUrl`, URL string expected — **PARTIAL** (XSD type string; product text live unread) | **UNKNOWN** (realty) | **UNKNOWN** |
| HTTPS? | **UNKNOWN** live (examples historically http) | Feed profile http(s) CONFIRMED for **feed file** URL; image HTTPS **UNKNOWN** | **UNKNOWN** |
| Max photos | **UNKNOWN** live (historical docs said 50 — not re-confirmed; not used as CONFIRMED) | **UNKNOWN** realty | **UNKNOWN** |
| Min photos | Archived XSD: `Photos` **optional** → schema min **0** | **UNKNOWN** | **UNKNOWN** |
| Format | **UNKNOWN** live | **UNKNOWN** | **UNKNOWN** |
| Dimensions | **UNKNOWN** live | **UNKNOWN** | **UNKNOWN** |
| Size | **UNKNOWN** live | **UNKNOWN** | **UNKNOWN** |
| Ordering | Document order of PhotoSchema — **PARTIAL** | **UNKNOWN** | **UNKNOWN** |
| Main/default photo | `IsDefault` optional boolean — **CONFIRMED** archived XSD | **UNKNOWN** | **UNKNOWN** |
| URL lifetime / cache | Same-URL binary replace behavior — **UNKNOWN** live | **UNKNOWN** | **UNKNOWN** |
| Provider fetch behavior | Provider fetches FullUrl — **PARTIAL** (URL field purpose) | Provider fetches image URLs in Autoload — **PARTIAL** (product) | **UNKNOWN** |

---

## 3. Per-provider verdict

### CIAN

| Label | Value |
|---|---|
| Contract status | **PARTIAL** |
| Evidence | Archived official `flatRent.xsd` (2023-07-11): `Photos` optional; `FullUrl`/`IsDefault` present |
| Live limits | **ACCOUNT_ACCESS_REQUIRED** |
| If photos included and `PropertyPhoto.url` is not provider-accessible absolute URL | **PHOTO_INFRASTRUCTURE_BLOCKER** |
| Schema-minimum without photos | Possible per archived XSD — photos **not** P0 for minimal schema validity |

### AVITO

| Label | Value |
|---|---|
| Contract status | **PARTIAL** (transport) / **UNKNOWN** (realty limits) |
| Evidence | Business Autoload confirms file-based publication; image URL mechanics need realty template |
| Realty photo tags/limits | **ACCOUNT_ACCESS_REQUIRED** |
| If emitting images with non-public URLs | **PHOTO_INFRASTRUCTURE_BLOCKER** |

### DOMCLICK

| Label | Value |
|---|---|
| Contract status | **UNKNOWN** |
| Evidence | No LT schema retrieved |
| Infrastructure | Treat as **PHOTO_INFRASTRUCTURE_BLOCKER** for any future feed that requires remote images — **until schema says otherwise** |

---

## 4. Classification (no single blanket without proof)

| Provider | Photo contract | Infrastructure |
|---|---|---|
| CIAN | PARTIAL | PHOTO_INFRASTRUCTURE_BLOCKER when URLs included/non-public |
| Avito | PARTIAL / UNKNOWN (realty) | PHOTO_INFRASTRUCTURE_BLOCKER when URLs included/non-public |
| Domclick | UNKNOWN | unresolved; blocker assumed for URL-based feeds until schema obtained |

---

## 5. Implications for Stage 8.2+

1. Do not implement CDN in 8.2.1.
2. Before any serializer emits photo URLs, CRM must guarantee provider-fetchable absolute URLs.
3. Prefer versioned URLs if CIAN live docs confirm cache-by-URL (currently UNKNOWN).
4. Map `IsDefault=true` to first `included` LongTermListingPhoto when CIAN photos are emitted.
