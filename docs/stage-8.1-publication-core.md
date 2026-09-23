# Stage 8.1 Publication Core

Код публикации на Avito / CIAN / Domclick **не** реализован. XML не генерируется. Реальных provider calls нет.

## 1. Architecture

```
Property
    ↓
LongTermListing          ← маркетинговые данные и фото (через LongTermListingPhoto)
    ↓
Publication              ← 1:N, максимум одна запись на SalesChannel
    ↓
future LongTermPublicationProvider   ← API или Feed, Stage 8.2+
```

`ChannelListing` не используется. Short-term Avito binding остаётся на `ChannelListing`.

`Publication.status` не меняет `LongTermListing.status`.

## 2. Prisma model

```
enum PublicationStatus {
  NOT_PUBLISHED
  PUBLISHING
  PUBLISHED
  UPDATE_PENDING
  UNPUBLISHING
  UNPUBLISHED
  ERROR
}

model Publication {
  id
  longTermListingId
  salesChannelId
  status              @default(NOT_PUBLISHED)
  externalId          String?   // NULL до первой успешной публикации
  externalStatus      String?   // сырой статус провайдера, без enum
  lastSyncAt
  lastSuccessAt
  lastErrorAt
  lastError           // redacted, без секретов
  createdAt
  updatedAt

  @@unique([longTermListingId, salesChannelId])
}
```

Не добавлено специально:

- snapshot JSON (цена/описание/фото) — выбран вариант A: всегда читать актуальный `LongTermListing`;
- `clientExternalId` — на этапе feed можно использовать `LongTermListing.id`;
- `transport` / provider payload — не класть бизнес-логику провайдера в Prisma;
- отдельные `AvitoPublication` / `CianPublication` / `DomclickPublication`.

## 3. Relations

- `LongTermListing` 1:N `Publication` (`onDelete: Cascade`)
- `SalesChannel` 1:N `Publication` (`onDelete: Restrict`)
- Каналы публикации: только `AVITO`, `CIAN`, `DOMCLICK` (`LONG_TERM_PUBLICATION_CHANNEL_CODES`)
- `DOMCLICK` добавлен в seed как identity канала; это не ChannelListing и не публикация

## 4. State machine

События (только внутренний `applyPublicationEvent`, не HTTP):

| From | Event | To |
|---|---|---|
| NOT_PUBLISHED | START_PUBLISH | PUBLISHING |
| PUBLISHING | CONFIRM_PUBLISHED | PUBLISHED |
| PUBLISHING | FAIL | ERROR |
| PUBLISHED | START_UPDATE | UPDATE_PENDING |
| UPDATE_PENDING | CONFIRM_PUBLISHED | PUBLISHED |
| UPDATE_PENDING | FAIL | ERROR |
| PUBLISHED | START_UNPUBLISH | UNPUBLISHING |
| UNPUBLISHING | CONFIRM_UNPUBLISHED | UNPUBLISHED |
| UNPUBLISHING | FAIL | ERROR |
| UNPUBLISHED | START_PUBLISH | PUBLISHING |
| ERROR | START_PUBLISH | PUBLISHING |
| ERROR | START_UPDATE | UPDATE_PENDING (только если есть `externalId`) |
| ERROR | START_UNPUBLISH | UNPUBLISHING (только если есть `externalId`) |

Запрещено, в том числе как «терминальные» ограничения:

- `NOT_PUBLISHED` → `PUBLISHED` (нет fake success)
- `PUBLISHED` → `NOT_PUBLISHED`
- `UNPUBLISHED` → `PUBLISHED` напрямую

HTTP не принимает `status`. Создание всегда `NOT_PUBLISHED`.

## 5. API contract

| Method | Path | Назначение |
|---|---|---|
| GET | `/api/long-term-listings/:id/publications` | Список публикаций карточки |
| POST | `/api/long-term-listings/:id/publications` | Создать или вернуть существующую (`{ salesChannelId }`) |
| GET | `/api/long-term-listings/:id/publications/:publicationId` | Одна публикация, только своей карточки |

POST body: `.strict()` только `salesChannelId`. Идемпотентность: повтор → 200 и та же запись.

Нет `/publish`, `/unpublish`, `/sync`. Нет PATCH.

## 6. Security

- Mass assignment: `status`, `externalId`, `externalStatus`, `lastSuccessAt`, `lastSyncAt` в POST отклоняются
- IDOR: publication запрашивается только в паре с `longTermListingId`
- `PUBLISHED` нельзя выставить через API
- `lastError` проходит `redactSecrets`
- CRM authentication по-прежнему отсутствует (долг Stage 7.3.1)

## 7. Idempotency

1. Application: `findUnique` до create
2. Unique constraint + обработка `P2002`
3. Retry/republication — та же строка (`UNPUBLISHED` → `START_PUBLISH`), не вторая Publication

## 8. Error handling

Хранится `lastError` / `lastErrorAt`. Токены, `client_secret`, `Authorization` не сохраняются.

`Publication ERROR` ≠ `LongTermListing ERROR`. Карточка может остаться `ACTIVE`.

## 9. Photo architecture

Publication не копирует файлы.

```
PropertyPhoto → LongTermListingPhoto → LongTermListing → Publication
```

Будущий serializer читает выбранные (`included`) фото актуальной карточки.

## 10. Provider abstraction

`lib/publications/provider.ts`:

- `transport: API | FEED`
- `capabilities()`
- опционально `execute()` и `generateFeed()`
- нет реальных адаптеров и нет generate XML

Snapshot: **не храним**. Актуальные title/price/photos всегда из `LongTermListing`. Плюс: один источник истины, нет рассинхрона. Минус: нельзя показать «как было опубликовано». Для 8.1 snapshot не нужен.

История: `IntegrationSyncLog` привязан к `IntegrationConnection` (сейчас Avito). Для CIAN/Domclick connection нет. Отдельный `PublicationLog` не создан — до реальных операций достаточно полей last* на Publication.

## 11. Migration

`prisma/migrations/20260902180000_long_term_publications/migration.sql`

Существующие Property / Booking / Guest / ChannelListing / LongTermListing / PropertyPhoto не изменяются разрушительно. Новая таблица пустая.

## 12. Tests

`tests/integrations/publication.test.ts`: create, duplicate, multi-channel, ARCHIVED, invalid/inactive channel, FSM, ERROR без смены listing status, redact secrets, mass assignment, IDOR.

## 13. Known limitations

- Нет реальной публикации
- Нет XML
- Нет credentials CIAN/Domclick
- `applyPublicationEvent` доступен в lib для будущего адаптера и тестов FSM; HTTP его не вызывает
- Публичные HTTPS URL фото по-прежнему не гарантированы
- CRM auth нет
- Минимальный read-only блок на карточке LongTerm, без кнопок publish/sync

## 14. Stage 8.2 readiness

READY для следующего этапа (CIAN feed или Avito Autoload) при условии:

- не расширять `SalesChannelAdapter` short-term методами LongTerm;
- писать статус провайдера в `externalStatus`, внутренний — в `status`;
- `CONFIRM_PUBLISHED` только после реального ответа/отчёта провайдера.
