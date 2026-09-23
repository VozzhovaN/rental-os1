# Stage 8.2.0 — Open Questions

Only questions that **cannot** be closed from public official documentation retrieved on **2026-09-21**.

Each item needs at least one of: provider support, partner/pro account, credentials, private documentation, or commercial contract.

---

## Avito

1. **Live Autoload template for long-term flat rent**  
   Exact XML/XLSX field names and required flags for category «Квартиры» + operation «Сдам» (or current equivalent). Live `autoload.avito.ru/format/realty` and category templates were captcha/IP gated.

2. **Unpublish semantics via Autoload**  
   Exact official FAQ wording: remove-from-file → archive vs deactivate vs delete; delays; re-publish cooldown (historically mentioned 30 days — not re-confirmed live).

3. **Photo rules for realty Autoload**  
   Max count, formats, min dimensions, max file size, HTTPS-only?, ZIP vs URL, main photo rule, duplicate/watermark rules, URL cache behavior.

4. **Autoload OAuth scopes vs existing STR scopes**  
   Which scopes are required for Autoload profile/upload/reports? Can the existing IntegrationConnection token call Autoload APIs?

5. **Feed URL authentication**  
   Does Avito support Basic Auth, signed URLs, or only public URL + IP allowlist for feed fetch?

6. **IP allowlist current values**  
   Official list of Avito crawler IPs (FAQ blocked).

7. **Moderation webhook**  
   Is there an official webhook for item moderation/publication events usable for LT Autoload items?

8. **Account packaging**  
   Exact tariff SKU required for realty Autoload on our target account type (agency vs private professional).

---

## CIAN

1. **Live XSD / docs refresh**  
   Confirm `feed_version`, required fields, and photo limits against **live** `cian.ru/xml_import/doc` and `flatRent.xsd` (both captcha-blocked this session). Archived snapshot used: **2023-07-11**.

2. **UNPUBLISH when object disappears from feed**  
   Official unambiguous answer: removed / archived / remains until paid term ends / requires manual action. **Blocks safe FSM unpublish.**

3. **ExternalId create vs update wording**  
   Explicit official statement that new ExternalId creates and existing updates (inferred from schema/role only → PARTIAL).

4. **Feed polling interval & import SLA**  
   Official numeric frequency and typical moderation delay.

5. **Photo URL cache policy (live)**  
   Confirm whether changing binary behind the same `FullUrl` updates the photo.

6. **Feed URL authentication**  
   Basic Auth / allowlist / public-only.

7. **Onboarding path**  
   Current official steps to register feed URL (LK vs email import@cian.ru) under captcha-free HelpDesk.

8. **BedsCount semantics**  
   Whether schema-required `BedsCount` means sleeping places or rooms; how to derive from CRM.

---

## Domclick

1. **Official XML schema for long-term secondary residential rental**  
   Public validator/help blocked by WAF; new-build schema must not be assumed.

2. **CREATE / UPDATE / UNPUBLISH rules for that schema**  
   Including external id field name and remove-from-feed behavior.

3. **Publication status / import report API**  
   Distinct from Statistics API and Chats API.

4. **Photo requirements**  
   Formats, size, HTTPS, max count, cache behavior.

5. **Account / commercial prerequisites**  
   Domclick PRO, accreditation, company roles allowed to register feeds, contract.

6. **Feed authentication options**  
   Public URL only vs auth.

7. **Credentials model**  
   What secret (if any) is required beyond feed URL registration.

---

## Cross-cutting (rental-os)

1. **Public media hosting**  
   Product decision for HTTPS CDN/stable URLs (implementation later — blocks all providers).

2. **Choice of stable feed id**  
   `LongTermListing.id` vs `Publication.id` vs dedicated `clientExternalId` column (schema change only in a later stage if needed).

3. **Whether CRM authentication (Stage 7.3.1 debt) is mandatory before enabling feed URLs in production**  
   Security policy, not provider docs.

---

## Explicitly closed / not open

- CIAN listings are **not** created via cabinet REST API — closed by https://promo.cian.site/api FAQ.
- Domclick Chats/Statistics APIs are **not** listing publication APIs — closed by scope separation.
- Avito Item API (audited OpenAPI mirror) does **not** expose create-listing — closed for that surface.
- Short-term Avito calendar/booking integration remains separate — closed by architecture.
