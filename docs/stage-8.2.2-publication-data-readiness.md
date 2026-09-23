# Stage 8.2.2 — Publication Data Readiness

**Project:** rental-os  
**Stage:** 8.2.2  
**Type:** IMPLEMENTATION / INTERNAL DATA MODEL  
**Date:** 2026-09-21  

Этап готовит внутренние данные долгосрочной аренды к будущей публикации.  
Сериализаторы площадок, HTTP к провайдерам и выполнение публикации **не** реализованы.

---

## 1. Domain ownership

| Слой | Отвечает за | Не отвечает за |
|---|---|---|
| **Property** | Фактические характеристики объекта: адрес, этаж, комнаты, площадь | Маркетинг объявления, контакт публикации, статус Publication |
| **LongTermListing** | Карточка аренды: цена, залог, комиссия карточки, срок, тексты, выбранные фото, контакт публикации | Физический этаж/адрес, XML площадки, FSM Publication |
| **Publication readiness** | Полнота набора данных для будущего publication pipeline | Требования CIAN/Avito/Domclick, доступность URL по HTTP |
| **PropertyPhoto / LongTermListingPhoto** | Хранение URL и выбор/порядок фото для карточки | CDN, mime/size, публичный хостинг |

Три валидации разделены:

1. Property validation — корректность фактических значений.
2. LongTermListing validation — корректность полей карточки при сохранении.
3. Publication readiness — можно ли технически передать карточку в будущий pipeline.

`Guest`, `Buyer` и гость бронирования **не** являются контактом публикации.

---

## 2. Schema audit — existing vs decision

| Existing field | Current model | Decision | Reason |
|---|---|---|---|
| `address`, `city`, `district` | Property | reuse | Фактический адрес уже обязателен |
| `floor` | Property `Int?` | reuse, **оставить nullable** | Этаж — характеристика объекта; NOT NULL сломал бы существующие записи |
| `totalFloors` | Property `Int?` | reuse | Уже есть |
| `rooms`, `area`, `bedrooms`, `bathrooms` | Property | reuse | Уже есть, не дублировать в listing |
| `latitude` / `longitude` | — | **не добавлять** | Gap analysis: CIAN Coordinates OPTIONAL / P2 |
| `monthlyPrice` | LongTermListing | reuse | SoT цены долгосрочной аренды |
| `specialOfferPrice`, `specialOfferText` | LongTermListing | reuse | Есть в карточке |
| `deposit` | LongTermListing `Int` | reuse | Денежный залог арендатора |
| `commission` | LongTermListing `Float` % | reuse, **MAPPING_BLOCKED** | Нельзя однозначно сопоставить ClientFee/AgentFee |
| `minimumRentalPeriod` | LongTermListing `Int` | reuse, **не переименовывать** | Уже валидируется и показывается как месяцы |
| `marketingTitle`, `description`, блоки текстов | LongTermListing | reuse | Маркетинг карточки |
| `PropertyPhoto.url`, `sortOrder` | PropertyPhoto | reuse | URL и порядок в пуле объекта |
| `LongTermListingPhoto.sortOrder`, `included` | LongTermListingPhoto | reuse | Выбор и порядок для объявления |
| `isPrimary` | — | **не добавлять в Prisma** | Primary = первое included фото по `sortOrder` |
| mime/width/height/checksum | — | **не добавлять** | Этапу не нужны |
| Publication `lastSerializedHash` | — | **не добавлять** | Serializer ещё нет; hash считается в памяти |
| `ownerName` / `ownerPhone` | Property | **не использовать** как publication contact | Другая роль |
| Email | — | **не добавлять** | Нет внутреннего требования; для площадок optional/UNKNOWN |

---

## 3. Schema changes

Добавлены **только** nullable поля контакта публикации на `LongTermListing`:

- `publicationContactName`
- `publicationPhoneCountryCode`
- `publicationPhoneNumber`

Модель `Publication` **не** менялась: unique, `externalId`, `externalStatus`, last*, FSM без изменений.

Миграция: `prisma/migrations/20260921143000_long_term_publication_contact/migration.sql`  
Существующие строки получают `NULL` по новым полям. `prisma migrate reset` не используется.

---

## 4. Publication contact

**Storage:** три поля на `LongTermListing`, не связанная сущность.

**Семантика телефона:**

- `publicationPhoneCountryCode` — цифры кода страны без `+` (например `7`). При вводе допускается `+7`.
- `publicationPhoneNumber` — национальный номер, только цифры, 6–15 символов.
- Пробелы по краям и внутри ввода отбрасываются; скобки, дефисы и произвольный текст отклоняются.
- Формат конкретной площадки **не** формируется и **не** хранится.

Email не хранится.

**Validation (карточка):** пустая строка → `null`; невалидный номер → ошибка Zod.  
**Readiness:** отсутствие имени/кода/номера → `MISSING_PUBLICATION_CONTACT`; невалидный номер в БД → `INVALID_PUBLICATION_PHONE`.

**UI:** блок «Контакт для публикации» на `/crm/long-term/[id]` и `/crm/long-term/[id]/edit`. Не смешивается с Guest/Owner.

---

## 5. Commission decision

**Decision:** оставить `LongTermListing.commission` как внутренний процент карточки.  
В normalized DTO поле копируется, `commissionMapping = MAPPING_BLOCKED`.

**Reason:** по Stage 8.2.1 неизвестно, это комиссия арендатора, агента или внутренняя management fee.  
Это не `Property.commissionMonthly`. Новую финансовую модель (payer / split ClientFee) **не** вводили.

Если `commission !== 0`, readiness добавляет warning `COMMISSION_MAPPING_UNRESOLVED`. Это не блокирует baseline.

---

## 6. Minimum rental period

Тип: `Int`. Единица: **месяцы**. Validation: целое ≥ 1. UI: «Минимальный срок, мес.»  
В DTO: `minimumRentalPeriodMonths` (имя DB-поля не менялось — миграция переименования не нужна).

---

## 7. Photos

Текущая архитектура сохранена:

```
PropertyPhoto.url
  → LongTermListingPhoto (included, sortOrder)
  → LongTermListing
```

CDN, отдельные CianPhoto/AvitoPhoto, mime/width/height — нет.

**CRM** по-прежнему принимает локальные и HTTP URL в `PropertyPhoto.url`.

**Readiness / publication URL:**

`isPublicPublicationPhotoUrl(url)` — только структурная проверка, без HTTP-запроса:

- абсолютный URL
- схема `https:`
- не localhost / 127.0.0.1 / ::1 / private IPv4 / `*.localhost` / `*.local`

Относительные `/uploads/...` и `http://` не считаются публичными.

**Baseline photos:**

- выбранные фото **не обязательны** (warning `MISSING_PHOTOS`); archived CIAN XSD: Photos optional, Avito/Domclick UNKNOWN;
- если фото **выбрано**, непубличный URL — **error** `PHOTO_URL_NOT_PUBLIC`.

Primary в DTO: первое included фото после сортировки по `sortOrder`, затем `photo.id`.

---

## 8. NormalizedLongTermPublicationData

Файл: `lib/publications/normalized-long-term.ts`

| Field | Source |
|---|---|
| `listingId` | LongTermListing.id |
| `title` | marketingTitle |
| `description` | склейка непустых текстовых блоков карточки в фиксированном порядке |
| `monthlyPrice` / special offer | LongTermListing |
| `deposit` | LongTermListing.deposit |
| `commission` + `commissionMapping` | commission + константа `MAPPING_BLOCKED` |
| `minimumRentalPeriodMonths` | minimumRentalPeriod |
| `property.*` | Property factual fields (без координат — их нет) |
| `contact.*` | publication* fields |
| `photos[]` | included LongTermListingPhoto + PropertyPhoto.url |

Builder: `buildNormalizedLongTermPublicationData(...)`  
Side effects: **нет** (не пишет БД, не меняет Publication, не вызывает провайдера, не генерирует XML).

---

## 9. Publication readiness

Файл: `lib/publications/readiness.ts`  
`validateLongTermPublicationReadiness(...)` → `{ ready, errors[], warnings[] }`  
Коды стабильные, UI-текст отдельно.

### Baseline errors

| Code | Rule |
|---|---|
| `LISTING_ARCHIVED` | status = ARCHIVED |
| `INVALID_MONTHLY_PRICE` | monthlyPrice ≤ 0 |
| `MISSING_DESCRIPTION` | пустое `description` карточки |
| `MISSING_ADDRESS` | пустые address или city |
| `INVALID_AREA` | area ≤ 0 |
| `MISSING_FLOOR` | `Property.floor == null` для APARTMENT и STUDIO (не HOUSE/OTHER) |
| `MISSING_PUBLICATION_CONTACT` | нет имени или телефона публикации |
| `INVALID_PUBLICATION_PHONE` | телефон не разбирается в код+цифры |
| `PHOTO_URL_NOT_PUBLIC` | included фото с непубличным URL |

ARCHIVED → `ready = false`. Существующие `Publication` не удаляются и не переводятся по FSM.

DRAFT/PAUSED с полными данными могут быть `ready = true`: это полнота данных, не публикация.

### Warnings

| Code | Rule |
|---|---|
| `MISSING_PHOTOS` | нет included фото |
| `EMPTY_TITLE` | пустой marketingTitle |
| `COMMISSION_MAPPING_UNRESOLVED` | commission ≠ 0 |

Сообщения не содержат «CIAN requires» / «Avito requires».  
Provider-specific validators на этом этапе **не** созданы.

Этаж в БД может быть NULL; readiness отклоняет квартиру/студию без этажа.  
`DB completeness ≠ publication completeness`.

---

## 10. Hash strategy

`hashNormalizedLongTermPublicationData(dto)`:

- SHA-256 hex
- канонический объект с фиксированным порядком ключей
- фото в порядке DTO (уже отсортированы)
- `null` для отсутствующих optional-полей, ключи не опускаются

**Persistence: NONE.** Hash не пишется в Publication.  
Причина: будущий provider payload может отличаться от normalized DTO; `lastSerializedHash` появится вместе с serializer.

Редактирование LongTermListing **не** переводит `PUBLISHED → UPDATE_PENDING`.

---

## 11. API

Новых publication/provider endpoint нет.

Readiness считается server-side на странице CRM. Отдельный `GET .../publication-readiness` не создавался: не нужен UI, не светит контакт публично.

PATCH `/api/long-term-listings/:id` — whitelist через Zod `.strict()`. Поля Publication (`status` площадки, `externalId`, `externalStatus`) не принимаются.

---

## 12. UI

- `/crm/long-term/[id]` — блок «Готовность к публикации» и «Контакт для публикации»
- `/crm/long-term/[id]/edit` — поля контакта отдельной секцией

Не утверждается Ready for CIAN / Avito.

---

## 13. Known gaps

- Нет координат Property.
- Commission mapping заблокирован до продуктового решения.
- Публичный хостинг фото не реализован; локальные URL остаются валидными в CRM.
- Live-контракты CIAN/Avito/Domclick по-прежнему BLOCKED (Stage 8.2.1).
- Email публикации нет.
- Hash не хранится.
- CRM auth отсутствует (долг 7.3.1).

---

## 14. Provider boundaries

Normalized DTO и baseline readiness — общие.  
Будущее:

```
baseline readiness
        +
provider-specific validation
        ↓
serializer (CIAN XML / Avito Autoload / Domclick feed)
```

Имена полей DTO не содержат CIAN/Avito/Domclick/XML/Autoload.

---

## 15. Future serializer boundary

Serializer должен:

- брать `NormalizedLongTermPublicationData`;
- сам форматировать телефон под площадку;
- не читать Guest;
- не считать `commission` = ClientFee без снятия `MAPPING_BLOCKED`;
- не публиковать фото с `isPublicPublicationPhotoUrl === false`;
- не вызывать `CONFIRM_PUBLISHED` без ответа провайдера.

---

## 16. Explicit non-goals

- NO CIAN XML
- NO Avito Autoload
- NO Domclick XML
- NO provider API calls
- NO provider-specific validator
- NO provider credentials
- NO publication execution (`/publish`, `/unpublish`, `/sync`)
- NO automatic Publication status changes
- NO CDN
- NO cron
- NO webhook
- NO fake publication statuses
- Avito short-term integration не изменялась
