# STAGE 7.3.1 FINAL REPORT

NO STAGE 8 CODE IMPLEMENTED

## 1. Dashboard income

Что было.

KPI `income` суммировал `totalAmount` всех календарных броней месяца: `PENDING` + `CONFIRMED` + `COMPLETED`. `CANCELLED` в календарь не входил. Счётчик `bookings` и остальные KPI не отделяли черновик от подтверждённого дохода.

Что изменено.

Доход считается только по подтверждённым статусам:

- `CONFIRMED` + `COMPLETED` → income
- `PENDING` → не входит в income
- `CANCELLED` → не входит в income и по-прежнему не входит в календарь

Счётчик броней, check-in/check-out, фильтры месяца, объекта и статуса не менялись. Если фильтр статуса = `PENDING`, календарь показывает эти брони, а income = 0.

Правило вынесено в `sumDashboardIncome` / `INCOME_BOOKING_STATUSES` в `lib/dashboard.ts`.

## 2. Property.monthlyPrice

Где использовалось.

| Место | Роль |
|---|---|
| `prisma/schema.prisma` `Property.monthlyPrice` | Поле модели объекта |
| `prisma/seed.ts` | Заполняется у seed-объектов |
| `lib/validations/property.ts` | Create/update Property |
| `lib/properties.ts` `serializeProperty` | Отдаётся в API/DTO |
| `components/properties/property-form.tsx` | Форма «Цена помесячно» |
| `components/properties/property-list.tsx` | Колонка списка |
| `lib/long-term-listings.ts` create | **Копировалось** в `LongTermListing.monthlyPrice` |
| Long-term UI/API/tests | Используют `LongTermListing.monthlyPrice` как цену карточки |

Вывод аудита:

1. Поле используется в CRM объекта (форма, список, API, seed) как ориентир экономики Property.
2. До 7.3.1 оно было вторым источником истины: при создании LongTermListing цена копировалась с Property.
3. Удалять колонку из Prisma сейчас небезопасно: сломаются form, list, seed, property API.
4. Синхронизацию `Property.monthlyPrice` ↔ `LongTermListing.monthlyPrice` не вводили.

Что сделано.

- Колонку **не удаляли**.
- Create LongTermListing больше не копирует цену: `monthlyPrice: 0`. Источник истины долгосрочной цены — `LongTermListing.monthlyPrice`.
- В schema добавлены комментарии, что поля не синхронизируются.
- В форме объекта — пояснение, что это ориентир объекта, а не цена долгосрочной карточки.

Остался ли technical debt.

Да. `Property.monthlyPrice` остаётся устаревшим полем экономики объекта. Безопасное удаление — отдельная миграция: убрать из schema, seed, property validation/API/UI, после явного решения, что ориентир больше не нужен.

## 3. API security boundary

Полноценная CRM authentication **не реализована**. Fake auth / `admin=true` не добавлялись.

Текущий доступ для всех `/api/*`: **unauthenticated** (открыто на уровне приложения).

**CRM authentication является обязательным перед production deployment.**

Классификация:

- `PUBLIC` — намеренно публичных бизнес-API нет.
- `CRM_INTERNAL` — все CRM CRUD, dashboard, интеграции (кроме OAuth callback).
- `INTEGRATION_CALLBACK` — редирект Avito OAuth.
- `SYSTEM/INTERNAL` — нет (health/cron endpoints отсутствуют).

| Endpoint | Method | Current access | Expected access | Risk | Auth required in future |
|---|---|---|---|---|---|
| `/api/properties` | GET | unauthenticated | CRM_INTERNAL | Medium: список объектов | Yes |
| `/api/properties` | POST | unauthenticated | CRM_INTERNAL | **High: создать Property** | Yes |
| `/api/properties/[id]` | GET | unauthenticated | CRM_INTERNAL | Medium | Yes |
| `/api/properties/[id]` | PATCH | unauthenticated | CRM_INTERNAL | **High: изменить Property** | Yes |
| `/api/properties/[id]` | DELETE | unauthenticated | CRM_INTERNAL | **High: удалить Property** | Yes |
| `/api/properties/[id]/photos` | GET | unauthenticated | CRM_INTERNAL | Medium | Yes |
| `/api/properties/[id]/photos` | POST | unauthenticated | CRM_INTERNAL | **High: загрузить фото** | Yes |
| `/api/properties/[id]/channels` | GET | unauthenticated | CRM_INTERNAL | Medium | Yes |
| `/api/properties/[id]/channels` | POST | unauthenticated | CRM_INTERNAL | **High: создать ChannelListing** | Yes |
| `/api/properties/[id]/channels/[listingId]` | GET | unauthenticated | CRM_INTERNAL | Medium | Yes |
| `/api/properties/[id]/channels/[listingId]` | PATCH | unauthenticated | CRM_INTERNAL | **High: изменить ChannelListing** | Yes |
| `/api/properties/[id]/channels/[listingId]` | DELETE | unauthenticated | CRM_INTERNAL | **High: отвязать канал** | Yes |
| `/api/properties/[id]/channels/[listingId]/sync` | POST | unauthenticated | CRM_INTERNAL | **High: sync listing** | Yes |
| `/api/guests` | GET | unauthenticated | CRM_INTERNAL | **High: PII гостей** | Yes |
| `/api/guests` | POST | unauthenticated | CRM_INTERNAL | **High: создать Guest** | Yes |
| `/api/guests/[id]` | GET | unauthenticated | CRM_INTERNAL | **High: PII** | Yes |
| `/api/guests/[id]` | PATCH | unauthenticated | CRM_INTERNAL | **High: изменить Guest** | Yes |
| `/api/guests/[id]` | DELETE | unauthenticated | CRM_INTERNAL | **High: удалить Guest** | Yes |
| `/api/guests/[id]/bookings` | GET | unauthenticated | CRM_INTERNAL | High: брони гостя | Yes |
| `/api/guests/[id]/history` | GET | unauthenticated | CRM_INTERNAL | Medium | Yes |
| `/api/guests/[id]/history` | POST | unauthenticated | CRM_INTERNAL | Medium: запись истории | Yes |
| `/api/bookings` | GET | unauthenticated | CRM_INTERNAL | High | Yes |
| `/api/bookings` | POST | unauthenticated | CRM_INTERNAL | **High: создать Booking** | Yes |
| `/api/bookings/[id]` | GET | unauthenticated | CRM_INTERNAL | High | Yes |
| `/api/bookings/[id]` | PATCH | unauthenticated | CRM_INTERNAL | **High: изменить Booking** | Yes |
| `/api/bookings/[id]` | DELETE | unauthenticated | CRM_INTERNAL | **High: удалить Booking** | Yes |
| `/api/bookings/[id]/check-in` | POST | unauthenticated | CRM_INTERNAL | **High: смена статуса** | Yes |
| `/api/bookings/[id]/check-out` | POST | unauthenticated | CRM_INTERNAL | **High: смена статуса** | Yes |
| `/api/dashboard` | GET | unauthenticated | CRM_INTERNAL | Medium: KPI/календарь | Yes |
| `/api/long-term-listings` | GET | unauthenticated | CRM_INTERNAL | Medium | Yes |
| `/api/long-term-listings` | POST | unauthenticated | CRM_INTERNAL | **High: создать LongTermListing** | Yes |
| `/api/long-term-listings/[id]` | GET | unauthenticated | CRM_INTERNAL | Medium | Yes |
| `/api/long-term-listings/[id]` | PATCH | unauthenticated | CRM_INTERNAL | **High: изменить LongTermListing** | Yes |
| `/api/long-term-listings/[id]` | DELETE | unauthenticated | CRM_INTERNAL | **High: архивировать карточку** | Yes |
| `/api/long-term-listings/[id]/photos` | GET | unauthenticated | CRM_INTERNAL | Medium | Yes |
| `/api/long-term-listings/[id]/photos` | PUT | unauthenticated | CRM_INTERNAL | **High: состав фото карточки** | Yes |
| `/api/sales-channels` | GET | unauthenticated | CRM_INTERNAL | Low | Yes |
| `/api/integrations` | GET | unauthenticated | CRM_INTERNAL | Medium: статус интеграций | Yes |
| `/api/integrations/avito` | GET | unauthenticated | CRM_INTERNAL | Medium | Yes |
| `/api/integrations/avito/connect` | POST | unauthenticated | CRM_INTERNAL | **High: начать OAuth / connect** | Yes |
| `/api/integrations/avito/callback` | GET | unauthenticated | INTEGRATION_CALLBACK | **High: завершить OAuth** (state cookie уже проверяется) | Callback должен остаться reachable для Avito; connect — только для CRM-сессии |
| `/api/integrations/avito/disconnect` | POST | unauthenticated | CRM_INTERNAL | **High: отключить интеграцию** | Yes |
| `/api/integrations/avito/listings` | GET | unauthenticated | CRM_INTERNAL | Medium | Yes |
| `/api/integrations/avito/listings/sync` | POST | unauthenticated | CRM_INTERNAL | **High: sync listings** | Yes |
| `/api/integrations/avito/sync` | POST | unauthenticated | CRM_INTERNAL | **High: полная sync Avito** | Yes |
| `/api/integrations/logs` | GET | unauthenticated | CRM_INTERNAL | High: operational logs | Yes |

Проверка опасных операций без authentication (сейчас возможны):

- изменить Property — да (`PATCH /api/properties/[id]`)
- создать Booking — да (`POST /api/bookings`)
- изменить Booking — да (`PATCH /api/bookings/[id]`, check-in/out)
- изменить Guest — да (`PATCH /api/guests/[id]`)
- изменить LongTermListing — да (`PATCH /api/long-term-listings/[id]`)
- загрузить фото — да (`POST /api/properties/[id]/photos`); отдельного DELETE фото нет, состав long-term фото меняется через `PUT .../photos`
- изменить ChannelListing — да (`PATCH/DELETE .../channels/[listingId]`)
- запустить опасную integration operation — да (`POST .../avito/sync`, listings sync, listing sync, disconnect, connect)

Это блокеры production, не Stage 8 domain code. Auth нужно внедрять отдельным этапом.

## 4. Mock Avito

Как ограничен environment.

Mock разрешён только если `NODE_ENV !== "production"` и (`AVITO_ADAPTER=mock` или `NODE_ENV=test`).

В production:

- `isMockAvito()` всегда `false`
- `AVITO_ADAPTER=mock` → `getAvitoAdapter()` бросает ошибку (fail-fast, без тихого fallback на mock)
- `getMockAvitoAdapter` / `resetMockAvitoAdapter` бросают ошибку
- `new MockAvitoAdapter()` бросает ошибку
- `serializeConnectionPublic` не считает соединение `connected` без токена

Архитектура Avito не менялась. Реальные Avito API endpoints не добавлялись.

## 5. Files changed

- `lib/dashboard.ts`
- `lib/long-term-listings.ts`
- `lib/integrations/mock-guard.ts` (новый)
- `lib/integrations/adapters/index.ts`
- `lib/integrations/adapters/mock-avito.ts`
- `lib/integrations/connections.ts`
- `prisma/schema.prisma`
- `components/properties/property-form.tsx`
- `tests/integrations/dashboard.test.ts` (новый)
- `tests/integrations/adapter.test.ts`
- `tests/integrations/long-term.test.ts`
- `package.json`
- `.env.example`
- `docs/stage-7.3.1-report.md`

## 6. Tests

`npm test` — **50/50 passed** (было 46).

Добавлено:

- dashboard income: PENDING/CANCELLED не в доходе; CONFIRMED+COMPLETED в доходе; month / property / status filters
- LongTermListing create не копирует `Property.monthlyPrice`
- Mock Avito запрещён в production

## 7. Static checks

lint: PASS

tsc: PASS

build: PASS

seed: PASS (10 объектов, 3 гостя, 6 броней, 10 каналов)

## 8. Regression

| Контур | Результат |
|---|---|
| Property | PASS |
| Guests | PASS (покрыт существующими booking/property тестами, API без ломающих изменений) |
| Bookings | PASS |
| Channels | PASS |
| Avito | PASS |
| LongTerm | PASS |
| Dashboard | PASS |

Особенно:

- Booking income: только CONFIRMED + COMPLETED
- PENDING: в календаре, не в income
- CONFIRMED: в календаре и в income
- COMPLETED: в календаре и в income
- CANCELLED: не в календаре, не в income
- LongTerm price: источник истины `LongTermListing.monthlyPrice`
- Property.monthlyPrice: оставлено, копирование в long-term убрано
- API access: без auth, задокументировано

## 9. Remaining limitations

1. **Нет CRM authentication.** Все `/api/*` открыты. Блокер production.
2. `Property.monthlyPrice` остаётся в схеме как technical debt (ориентир объекта, не long-term цена).
3. SQLite: нет exclusion constraint на overlap броней.
4. Отдельного DELETE endpoint для PropertyPhoto нет.
5. Seed не удаляет лишние LongTermListing, созданные вручную.
6. Физическое удаление CRM-брони без ExternalBooking сохранено.

## 10. Stage 8 readiness

READY

С документированными ограничениями: CRM auth обязателен перед production; `Property.monthlyPrice` не удалялся; SQLite race на overlap.

## 11. Scope check

Stage 8 code implemented: NO

Sale code implemented: NO

New external integrations implemented: NO

CRM authentication implemented: NO
