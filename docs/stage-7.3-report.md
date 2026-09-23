# Stage 7.3 — Professional Hardening Report

NO STAGE 8 CODE IMPLEMENTED

## 1. Audit summary

Проведён аудит Prisma, API, lib, validation, DTO, CRM UI, Dashboard, Booking, Guest, ChannelListing, Avito, LongTermListing, фото, тестов, env и seed.

Согласованная архитектура сохранена:

- Property — физический объект;
- short-term: Property → Booking → ChannelListing → SalesChannel;
- long-term: Property → LongTermListing;
- SaleListing не создавался;
- ChannelListing не используется для долгосрочной публикации.

## 2. Found issues

### CRITICAL

| ID | File | Current | Expected | Risk | Fix |
|---|---|---|---|---|---|
| BOOKING-001 | `lib/bookings.ts` | Overlap check, затем отдельный create | Проверка и запись атомарны | Двойное бронирование при параллельных POST | `$transaction` + overlap внутри транзакции |
| SEC-001 | `lib/integrations/crypto.ts` | Fallback-ключ `rental-os-local-dev-only` | Fail-fast в production | Компрометация токенов Avito | Throw если нет `INTEGRATION_ENCRYPTION_KEY` в production |

### HIGH

| ID | File | Current | Expected | Risk | Decision |
|---|---|---|---|---|---|
| BOOKING-002/003 | `lib/bookings.ts` | Любой статус через PATCH; check-in из COMPLETED | FSM переходов | Откат завершённой брони | Fixed |
| BOOKING-005 | `lib/bookings.ts` | Hard DELETE любой брони | Нельзя удалить imported booking | Потеря Avito mapping | Fixed: 409 если есть ExternalBooking |
| CASCADE-01/03 | `lib/properties.ts` | DELETE Property мог каскадно снести ChannelListing или дать неясный P2003 | Явный 409 | Потеря интеграций / путаница | Fixed: pre-check, cascade schema не менялся |
| AUTH-01 | `app/api/**` | Нет CRM auth | Auth middleware | Открытые API | **Documented**, новый auth запрещён scope |
| FAKE-CONNECTED | `lib/integrations/connections.ts` | `connected=true` по одному status | Нужен токен (кроме mock) | Ложный CONNECTED | Fixed |
| TEST-01 | `tests/` | Не было booking/property CRUD | Regression | Слепые регрессии | Fixed: новые тесты |

### MEDIUM (выборочно исправлено)

- Per-listing error count в `syncBookings`
- `redactSecrets` не применялся к integration errors
- Create booking принимал CANCELLED/COMPLETED
- Бронь на INACTIVE property
- UTF-8 / `code` в error payload без ломки UI
- Confirm архивации LongTermListing
- Photo IDOR без теста
- OAuth cookie без `secure` в production
- Длина URL / marketingTitle / description

### LOW / documented, не менялось

- `Property.monthlyPrice` существует с ранних этапов; схема не мигрировалась (архитектура зафиксирована)
- Dashboard income включает PENDING
- Нет PostgreSQL exclusion constraint
- GuestHistory cascade при удалении гостя без броней
- Полная унификация `{ error: { code, message } }` не внедрялась — сломала бы UI

## 3. Fixed issues

- Overlap create/update внутри Prisma transaction
- COMPLETED учитывается как occupying (даты завершённой брони нельзя занять повторно)
- FSM брони: COMPLETED/CANCELLED терминальны; check-in только PENDING; checkout PENDING/CONFIRMED
- DELETE импортированной брони → CONFLICT
- DELETE Property блокируется при Booking / ChannelListing / LongTermListing
- Production encryption key обязателен
- `connected` требует токен, кроме `AVITO_ADAPTER=mock`
- `redactSecrets` на integration error messages
- Per-listing sync error accounting
- Create booking status только PENDING/CONFIRMED
- Неактивный Property нельзя забронировать
- Error envelope: `{ error, code?, details? }` + charset utf-8 на ключевых CRM API
- Confirm архивации long-term
- Photo IDOR test
- OAuth cookie `secure` в production
- `npm run prisma:seed`

## 4. Files changed

- `lib/api-json.ts`
- `lib/bookings.ts`
- `lib/properties.ts`
- `lib/validations/guest.ts`
- `lib/validations/property.ts`
- `lib/validations/long-term-listing.ts`
- `lib/integrations/crypto.ts`
- `lib/integrations/connections.ts`
- `lib/integrations/errors.ts`
- `lib/integrations/avito-service.ts`
- `lib/integrations/import-booking.ts`
- `app/api/bookings/route.ts`
- `app/api/bookings/[id]/route.ts`
- `app/api/bookings/[id]/check-in/route.ts`
- `app/api/bookings/[id]/check-out/route.ts`
- `app/api/properties/[id]/route.ts`
- `app/api/integrations/avito/connect/route.ts`
- `components/bookings/booking-actions.tsx`
- `components/long-term/long-term-form.tsx`
- `tests/integrations/booking.test.ts` (new)
- `tests/integrations/property.test.ts` (new)
- `tests/integrations/long-term.test.ts`
- `package.json`
- `.env.example`
- `docs/stage-7.3-report.md` (this file)

## 5. Database changes

Prisma schema / migrations: **не менялись**.

Cascade behavior: **не менялся**. Защита удаления Property сделана pre-check в `deleteProperty`.

## 6. API changes

Обратная совместимость UI сохранена: поле `error` по-прежнему строка.

Добавлено опциональное `code`: `VALIDATION_ERROR | NOT_FOUND | CONFLICT | INTEGRATION_ERROR | INTERNAL_ERROR`.

Long-term PATCH `propertyId` по-прежнему 400 (strict).

DELETE booking с ExternalBooking → 409.

DELETE property с зависимостями → 409 с точным текстом.

Вложенный формат `{ error: { code, message } }` **не внедрялся**, чтобы не ломать формы.

## 7. Security changes

- Production fail-fast без `INTEGRATION_ENCRYPTION_KEY`
- Integration errors проходят `redactSecrets`
- Tokens по-прежнему не в DTO
- `rawData` ExternalBooking не отдаётся API
- Photo IDOR: чужой `photoId` → VALIDATION + тест
- PropertyId LongTermListing immutable
- Imported booking нельзя физически удалить
- CRM auth **не добавлялся** (запрет scope)

## 8. Tests added

- `tests/integrations/booking.test.ts` — create, overlap, checkout boundary, FSM, cancel frees dates, imported delete, capacity, inactive property
- `tests/integrations/property.test.ts` — delete blocked by booking / channel / long-term; free property delete
- Long-term: photo IDOR cross-property

## 9. Tests passed

`npm test` — 46/46 passed

## 10. Known limitations

1. **SQLite** не даёт exclusion constraint. Transaction снижает race, но абсолютная гарантия — на PostgreSQL в будущем.
2. **Нет CRM authentication.** Все `/api/*` открыты на уровне приложения.
3. **Property.monthlyPrice** остаётся в модели Property с ранних этапов; не переносился.
4. Dashboard KPI `income` суммирует PENDING+CONFIRMED+COMPLETED (не менялось функционально).
5. Seed не удаляет лишние LongTermListing, созданные вручную.
6. Mock Avito может быть `connected` без accessToken (`AVITO_ADAPTER=mock`).
7. Физическое удаление CRM-брони без ExternalBooking сохранено (не soft-delete всех броней).

## 11. Risks for Stage 8

- Публикация LongTermListing должна идти через **новую** сущность (LongTermPublication), не через ChannelListing.
- Перед Stage 8 желателен PostgreSQL, если нужна жёсткая защита overlap.
- Перед production-публикации нужен auth слой.
- Avito long-term API — отдельный контур, не short-term ChannelListing.

## 12. Final acceptance result

READY FOR STAGE 8 — с документированными ограничениями (auth, SQLite race, Property.monthlyPrice).

NO STAGE 8 CODE IMPLEMENTED
NO SALE CODE IMPLEMENTED
NO NEW EXTERNAL INTEGRATIONS IMPLEMENTED
