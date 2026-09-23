# Stage 11.3 — Final Security Hardening

## Audit scope

Authentication/sessions, CSRF, API validation, headers/CSP, XSS, secrets/env, crypto, Avito OAuth state, SSRF, media URLs, CIAN XML/feeds, logging, Prisma raw SQL, CORS, dependencies.

## Fixed

| Finding | Severity | Fix |
|---|---|---|
| Missing security headers / CSP | MEDIUM | `next.config.ts` headers + `lib/security/headers.ts` |
| Missing string max lengths (Property / LT / Guest) | MEDIUM | Zod `.max()` + `.strict()` where missing |
| Weak production secret lengths | MEDIUM | `SESSION_SECRET` ≥32; `INTEGRATION_ENCRYPTION_KEY` ≥32 in production |
| Avito absolute URL SSRF surface | MEDIUM | `resolveAvitoApiUrl` allowlists `https://api.avito.ru` only |
| OAuth state not cleared on all callback paths | LOW | Clear `avito_oauth_state` on every callback redirect (one-time) |
| Decrypt failures could throw | LOW | `decryptSecret` fails closed → `null` |
| Incomplete log redaction | LOW | Expanded `redactSecrets`; dashboard logs redacted |
| Lint unused `_request` warnings | LOW | ESLint `argsIgnorePattern: ^_` |
| Photo URL path traversal / schemes | LOW | Reject `..`, non-http(s) schemes |

## Accepted limitations

| Finding | Reason | Target |
|---|---|---|
| CSP `script-src 'unsafe-inline'` (prod) | Next App Router without nonce pipeline | Stage 13 if nonce CSP adopted |
| CSP `unsafe-eval` in development | Next/Turbopack HMR | Dev only |
| In-memory login rate limit | Single-process architecture | Stage 13 / Redis |
| SQLite local DB | Current persistence | Stage 13 production DB |
| No binary upload pipeline | URL-only photos | Later if uploads added |
| EXTERNAL_CALLBACK_AUTH | No Avito callback signature beyond OAuth state | Provider confirmation |

## External blockers

- Avito callback authenticity beyond OAuth `state`
- CIAN status sync / unpublish (earlier stages)
- Provider credentials for live publication

## Production blockers remaining

- Multi-instance rate limiting
- Production database + backups
- TLS / reverse proxy / deployment
- Monitoring / alerting
- Strong production secrets set (`SESSION_SECRET`, `APP_ORIGIN`, encryption key)
- Optional: CSP nonces to remove `unsafe-inline` scripts
