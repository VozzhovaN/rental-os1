# Stage 8.0 Publication Architecture

Статус этапа: **аудит и архитектура**. Код публикации не писался. Prisma schema не менялась. Stage 8 implementation не начат.

Официальные источники, использованные в этом документе:

| Провайдер | Источник | URL |
|---|---|---|
| Avito | Портал разработчика, каталог API | https://developers.avito.ru/ , https://developers.avito.ru/api-catalog |
| Avito | О приложении / тарифах | https://developers.avito.ru/about-api |
| Avito | Регистрация приложений | https://developers.avito.ru/applications |
| Avito | Условия API | https://developers.avito.ru/docs/APITermsOfServiceV1.pdf |
| Avito | Автозагрузка: инструкция | https://www.avito.ru/autoload/documentation |
| Avito | Автозагрузка: правила и шаблоны | https://www.avito.ru/autoload/documentation/templates |
| Avito | Автозагрузка: FAQ | https://www.avito.ru/autoload/documentation/faq |
| Avito | Существующая CRM-интеграция | `lib/integrations/adapters/avito.ts` (short-term) |
| CIAN | Промо Циан API | https://promo.cian.site/api |
| CIAN | Публичное API (OpenAPI) | https://public-api.cian.ru/ |
| CIAN | XML-выгрузка, технические требования | https://www.cian.ru/xml_import/doc/ (live — captcha; содержимое сверено с официальным снимком той же страницы) |
| CIAN | HelpDesk, раздел XML-выгрузка | https://support.cian.ru/ (live — captcha) |
| Domclick | Валидатор / требования к фиду | https://domclick.ru/validation |
| Domclick | Справка | https://help.domclick.ru/ |
| Domclick | Chats API | https://public-api.domclick.ru/chats |
| Domclick | Statistics API | https://public-api.domclick.ru/stats |

Не использовались: GitHub-репозитории, неофициальные SDK, StackOverflow, блоги CRM, форумы, reverse-engineered API.

---

## 1. Goal

Зафиксировать Publication Layer для **долгосрочной аренды** до любой реализации.

Нужно:

- разделить ShortTerm и LongTerm;
- не использовать `ChannelListing` для LongTerm;
- описать реальные capability Avito / CIAN / Domclick;
- выбрать transport per provider (API vs feed), а не универсальный `createListing()`;
- явно пометить DOCUMENTATION GAP и UNKNOWN.

Не цель этого этапа: публикация, адаптеры, API routes, UI, новые Prisma models.

---

## 2. Existing architecture

Текущий контур CRM:

```
Property  ──► Booking + ChannelListing + SalesChannel     (SHORT-TERM)
          └──► LongTermListing + LongTermListingPhoto     (LONG-TERM, без публикации)
```

- `Property` — физический объект (площадь, комнаты, адрес, фото).
- `LongTermListing` — источник маркетинговых данных долгосрочной аренды (цена, описание, залог, комиссия, срок, спецпредложение, состав фото).
- `ChannelListing` — привязка **уже существующего** short-term объявления Avito (`externalId`). Импорт броней и выгрузка занятости. Не карточка долгосрочной аренды.
- Avito adapter (`SalesChannelAdapter`) работает со scopes `short_term_rent:read,short_term_rent:write` и endpoint’ами бронирования/календаря. Это **не** API создания долгосрочного объявления.
- `LongTermListingDTO.publications` сейчас заглушка: `{ avito, cian, domclick: "unpublished" }`. Это UI-зарезервированное поле, не Publication Layer.

Целевая архитектура (не реализована):

```
Property
    ↓
LongTermListing
    ↓
Future Publication Layer          ← отдельная сущность на listing × provider
    ↓
Provider (API и/или XML feed)
```

Правила разделения:

- ShortTerm publication / binding остаётся на `ChannelListing`.
- LongTerm publication **не** идёт в `ChannelListing`.
- `ChannelListing.externalId` **не** использовать как LongTerm external id.
- Связи LongTerm → ChannelListing не создавать.
- Ошибка одного провайдера не меняет `LongTermListing.status`.

---

## 3. Provider capability audit

### Avito

#### SHORT-TERM (уже в rental-os)

Используемые официальные контуры (подтверждены кодом + каталогом `developers.avito.ru/api-catalog`):

| Операция | Реализация | Примечание |
|---|---|---|
| Authentication | OAuth2 `authorization_code` и `client_credentials` → `POST https://api.avito.ru/token` | Scopes по умолчанию: `short_term_rent:read,short_term_rent:write` |
| Account connection | CRM connect/callback/disconnect | Токены в `IntegrationConnection`, шифрование AES-GCM |
| Listing retrieval | `GET /core/v1/items` | Список объявлений аккаунта, не создание |
| Listing binding | `ChannelListing.externalId` | Ручная/синхронизируемая привязка **существующего** item |
| Bookings import | `GET /realty/v1/accounts/{user_id}/items/{item_id}/bookings` | STR |
| Availability export | `POST /core/v1/accounts/{user_id}/items/{item_id}/bookings` | STR occupancy |
| Price push | `pushPrices()` — no-op | Не реализовано |
| Create listing | нет | Не используется и не подтверждено для STR create |
| Long-term fields | нет | Scopes и realty bookings — краткосрочная аренда |

Contractual: портал разработчика требует один из платных тарифов «Базовый» / «Расширенный» / «Максимальный». Приложение регистрируется на https://developers.avito.ru/applications. Credentials: `AVITO_CLIENT_ID`, `AVITO_CLIENT_SECRET`, `AVITO_REDIRECT_URI`, опционально `AVITO_USER_ID`.

Rate limits: CRM ретраит HTTP 429. Точные лимиты каталога STR/Item в этой сессии **не прочитаны** (captcha на `developers.avito.ru/api-catalog/*`). DOCUMENTATION GAP: per-method limits.

Webhook публикации объявлений: в текущей интеграции нет. DOCUMENTATION GAP: есть ли webhook на смену статуса item.

#### LONG-TERM

**Можно ли создать LONG-TERM listing через REST API?**  
Не подтверждено официальной документацией, доступной в этой сессии. Каталог `developers.avito.ru/api-catalog/item` и `.../str` отдавали captcha. STR-контур rental-os не содержит create listing. **Не считать REST createListing() доступным. Не изобретать альтернативный API.**

**Подтверждённый механизм публикации (официальная Автозагрузка):**

Источник: https://www.avito.ru/autoload/documentation и FAQ.

Автозагрузка — профессиональный инструмент: размещать, обновлять и продвигать объявления файлом Excel / XML / CSV.

| Capability | Статус | Как |
|---|---|---|
| Create | SUPPORTED (feed) | Новая строка/объект в файле категории |
| Update | SUPPORTED (feed) | Изменить параметры, **не менять Id и AvitoId** |
| Publish | SUPPORTED (feed) | Загрузка вручную или по HTTPS-ссылке по расписанию |
| Unpublish | SUPPORTED (feed) | Удалить объявление из файла → после загрузки в архив |
| Delete forever | PARTIAL | Из файла — только архив; окончательное удаление в UI «Мои объявления» → Архив |
| Photos | SUPPORTED (feed) | `ImageUrls` (http/https, прямая ссылка) или ZIP + `ImageNames` |
| Description / price / address | SUPPORTED (feed) | Параметры категории в шаблоне |
| External ID | SUPPORTED | `Id` (наш) + `AvitoId` (id на Авито) |
| Result | SUPPORTED | Отчёт в ЛК Автозагрузка + email; история загрузок |
| Errors | SUPPORTED | Отчёт по каждому Id |
| Moderation status | UNKNOWN | Не описан в прочитанной инструкции автозагрузки как отдельное API-поле |
| REST create/update/unpublish | UNKNOWN / NOT_CONFIRMED | DOCUMENTATION GAP каталога API |
| Autoload reports API | UNKNOWN | FAQ: «Если вы используете CRM, можете получать отчёты об автозагрузке прямо в ней. В документации написано, как это сделать» → отсылка к каталогу, который не удалось прочитать |

Условия автозагрузки (FAQ, официально):

- Для «Недвижимость» раздел открывается при подключении тарифа.
- Файл по ссылке: до 500 МБ; HTTP/HTTPS порты 80/443; прямые ссылки; allowlist IP Авито.
- Ручная загрузка: файл + ZIP ≤ 100 МБ.
- Дубли: смена `Id` создаёт новое объявление и может заблокировать как дубль.
- Снятие: удаление из файла. Повтор похожего — не раньше 30 дней с публикации удалённого.

**Вывод Avito LongTerm:** transport = **Autoload feed**, не STR adapter и не `ChannelListing`. REST item create не использовать, пока официальный каталог явно не подтвердит методы. Listing retrieval `GET /core/v1/items` можно позже использовать как **read-side** после появления item, без смешивания с short-term binding.

### CIAN

#### API vs XML

Официальный FAQ https://promo.cian.site/api :

> «Можно ли передавать объявления по Циан API?»  
> **«Автоматическая выгрузка объявлений происходит при помощи XML-файла.»**

> «Могу ли я управлять ставками объявлений при помощи Циан API?»  
> Ставки/баланс — API (чтение). **Продвижение и изменение ставок — XML-файл.**

https://public-api.cian.ru/ — это **кабинетный** API, не publication API. Методов create/update/publish/unpublish/delete объявления в спецификации нет.

API, относящиеся к объявлениям (чтение / отчёты):

| Метод | Назначение |
|---|---|
| `GET /v1/get-my-offers` (deprecated), `GET /v2/get-my-offers` | Список объявлений. `source=manual\|upload`, статусы `inactive`, `published`, `refusedByModerator`, `removedByModerator` |
| `GET /v1/get-my-offers-detail` | Детали: `externalId`, `id`, `url`, `userId` |
| `GET /v1/get-last-order-info` | Состояние последнего импорта XML: URL фида, проблемы с объявлениями/фото, `orderId` |
| `GET /v1/get-order` | Отчёт импорта: `externalId`, `offerId`, `status`, `url`, `errors[]`, `warnings[]` |
| `GET /v1/get-images-report` | Ошибки изображений фида |
| `GET` уведомления модерации | Polling модерации |
| Webhooks v2/v3 | Чаты и `systemMessages` (Циан/модерация). **Не webhook публикации listing** |

Auth API: `Authorization: Bearer <ACCESS KEY>`. Ключ: письмо на import@cian.ru с темой `ACCESS KEY` **или** получение в ЛК (промо-страница: «Получите ключ Циан API в личном кабинете»). Отдельный ключ на учётную запись. Доступ: риелторы/агентства/застройщики на тарифах базовый и застройщик. Оценка/Заявки — отдельно платно (`b2bdatasales@cian.ru`).

Rate limits API (официально): не более **10 запросов/сек** на метод; ответы 400/401/429/500.

#### XML feed (механизм публикации)

Источник: https://www.cian.ru/xml_import/doc/

- Постоянный URL, HTTP, UTF-8 или Windows-1251.
- Корень `Feed` / `Feed_Version` / `Object`.
- Категория долгосрочной квартиры: **`flatRent`**. Также `roomRent`, `houseRent`, `cottageRent`, `townhouseRent`, `bedRent`.
- Идемпотентность: **`ExternalId`** — уникальный номер объекта в фиде/CRM.
- После импорта CIAN выдаёт `offerId` (в отчёте API).
- Цена: `BargainTerms.Price`. Залог: `Deposit`. Комиссия: `ClientFee` / `AgentFee` в %. Срок: `LeaseTermType` = `fewMonths` \| `longTerm`. Предоплата: `PrepayMonths`.
- Описание: 15–3000 символов; без `&`; html вырезается.
- Заголовок `Title`: только при Топ/Премиум, 8–33 символа.
- Адрес: как на Яндекс Картах. Координаты опциональны.
- Фото: URL (`Photos.FullUrl`), max 50, JPG/PNG/GIF, 200px–10 МБ, рекомендуемое 600×800–1024×1024. Главное: `IsDefault=true`. Смена фото = **новый URL**; тот же URL с новым файлом игнорируется.
- Срок публикации жилой долгосрочной аренды: **7 дней** (`PublishTerms`), продление пакетами/продвижением.
- Подключение фида: письмо на import@cian.ru (ID аккаунта, тип выгрузки, email отчётов, URL XML) — подтверждается экосистемой CIAN import; live HelpDesk в сессии был за captcha. DOCUMENTATION GAP: точный onboarding-текст HelpDesk.

**Снятие с публикации через XML:** в прочитанной спецификации нет отдельного тега `Delete`/`Unpublish`. Актуальный набор объявлений = содержимое фида. Точная семантика «объект исчез из фида» как unpublish — DOCUMENTATION GAP (проверить в ЛК/HelpDesk перед реализацией). Статус `inactive` читается API.

**Вывод CIAN:** для LongTermListing подходит **XML feed** как write-path и **CIAN API** как read-path (статус импорта, offerId, модерация). Не выбирать API для create только потому, что API существует.

### Domclick

Разделение обязательно:

| Контур | Это публикация? | Официальное подтверждение |
|---|---|---|
| XML / feed + валидатор | Да, это publication mechanism | https://domclick.ru/validation (страница существует; тело требований в этой сессии за WAF) |
| Statistics API `public-api.domclick.ru/stats` | **Нет** | Корень метода отдал `Not found`; домен официальный. Не использовать как publication |
| Chats API `public-api.domclick.ru/chats` | **Нет** | Официальный swagger: чаты агентства, вебхуки сообщений, агенты. Bearer token. Нет create listing |
| help.domclick.ru | Справка | Live за WAF; схема полей не прочитана |

**Publication API (REST create/update/publish):** в доступных официальных документах **не найден**. NOT_SUPPORTED до появления официальных методов.

**XML feed:** механизм публикации на Домклик официально существует (валидатор). Полная схема тегов для **долгосрочной аренды вторички** в этой сессии **не извлечена**. Известно по URL валидатора, что есть требования и Validator. Не подменять схему новостроек/ЖК схемой аренды без официального документа.

DOCUMENTATION GAP (Domclick, критичный):

- XML-схема именно для аренды квартиры (не ЖК).
- Обязательные поля, фото, ExternalId, снятие с публикации.
- Как подключается фид в ЛК (роли компании).
- Связь Statistics API `offer_id` с ExternalId фида.
- Rate limits publication (их нет, если нет publication API).

**Вывод Domclick:** Statistics API и Chats API **не** publication. Основной кандидат — **feed**. Пока схема не прочитана с help/validation — не реализовывать адаптер и не выдумывать теги.

---

## 4. Capability matrix

Легенда: **SUPPORTED** / **NOT_SUPPORTED** / **UNKNOWN**. UNKNOWN не равен SUPPORTED.

Для Avito колонка = **LongTerm** (не STR), если не указано иное.

| Capability | Avito | CIAN | Domclick |
|---|---|---|---|
| Authentication | SUPPORTED (OAuth2 token) | SUPPORTED (Bearer ACCESS KEY) | SUPPORTED для chats/stats (Bearer). Publication API: NOT_SUPPORTED |
| Create | SUPPORTED via Autoload feed. REST: UNKNOWN | SUPPORTED via XML. API create: NOT_SUPPORTED | UNKNOWN via XML. API create: NOT_SUPPORTED |
| Update | SUPPORTED via Autoload (stable Id/AvitoId). REST: UNKNOWN | SUPPORTED via XML (same ExternalId). API update: NOT_SUPPORTED | UNKNOWN via XML. API: NOT_SUPPORTED |
| Publish | SUPPORTED via Autoload upload/schedule | SUPPORTED via XML import | UNKNOWN (feed presumed, schema unread) |
| Unpublish | SUPPORTED via remove-from-file → archive | UNKNOWN (likely omit from feed; не подтверждено спецификацией) | UNKNOWN |
| Delete | PARTIAL: archive via feed; hard delete UI | NOT_SUPPORTED via API. XML: UNKNOWN | UNKNOWN |
| Photos | SUPPORTED (URL or ZIP in Autoload) | SUPPORTED (URL in XML, max 50) | UNKNOWN |
| Description | SUPPORTED (Autoload category params; точные лимиты шаблона realty — UNKNOWN) | SUPPORTED (15–3000 chars) | UNKNOWN |
| Price | SUPPORTED (Autoload) | SUPPORTED (`BargainTerms.Price`) | UNKNOWN |
| Address | SUPPORTED (Autoload) | SUPPORTED (`Address` as Yandex) | UNKNOWN |
| External ID | SUPPORTED (`Id` + `AvitoId`) | SUPPORTED (`ExternalId` + `offerId`) | UNKNOWN |
| Moderation status | UNKNOWN as API field | SUPPORTED read (`refusedByModerator`, moderation notifications, import errors) | UNKNOWN |
| Publication status | PARTIAL: Autoload report + optionally `GET /core/v1/items` | SUPPORTED read (`published`/`inactive`/…) | UNKNOWN |
| Errors | SUPPORTED (Autoload report). REST codes: PARTIAL in CRM (401/429/5xx) | SUPPORTED (API 400/401/429/500 + import `errors[]`) | UNKNOWN publication. Chats/stats: UNKNOWN codes beyond HTTP |
| Rate limits | UNKNOWN (catalog unread). CRM retries 429 | SUPPORTED (≤10 rps/method) | UNKNOWN |
| Webhook | UNKNOWN for listing status | SUPPORTED for chats/systemMessages. NOT_SUPPORTED as listing publish webhook | SUPPORTED for chats. NOT_SUPPORTED as listing publish webhook |
| Polling | PARTIAL: Autoload report / items list | SUPPORTED: import report + offers + moderation notifications | PARTIAL: stats GET is not publication status |
| XML feed | SUPPORTED (Autoload XML/XLSX/CSV) | SUPPORTED | SUPPORTED as mechanism (validator). Schema: UNKNOWN |
| API | SUPPORTED STR/item read. NOT_CONFIRMED LongTerm write | SUPPORTED read/reports. NOT_SUPPORTED write listing | NOT_SUPPORTED publication. SUPPORTED chats + stats (non-publish) |
| Required credentials | client_id, client_secret, redirect_uri; paid tariff; Autoload enabled | ACCESS KEY; agency tariff; feed URL registered | Company account / PRO. Exact publication credentials: UNKNOWN. Stats/chats token ≠ publication |

---

## 5. Data mapping

Предварительный mapping. Prisma **не** менять. Отсутствующие поля = **MISSING DOMAIN FIELD**.

### LongTermListing → provider

| CRM field | Avito Autoload | CIAN XML `flatRent` | Domclick |
|---|---|---|---|
| `marketingTitle` | параметр названия/заголовка категории (точное имя в шаблоне realty — UNKNOWN) | `Title` (только Топ/Премиум, 8–33) | UNKNOWN |
| `description` + блоки terms/infrastructure/… | описание категории | `Description` 15–3000; склеивать блоки; без `&` | UNKNOWN |
| `monthlyPrice` | цена | `BargainTerms.Price` | UNKNOWN |
| `deposit` | UNKNOWN в шаблоне realty (не прочитан) | `BargainTerms.Deposit` | UNKNOWN |
| `commission` | UNKNOWN | `ClientFee` / `AgentFee` (%). Смысл CRM-комиссии может не совпасть | UNKNOWN |
| `minimumRentalPeriod` | UNKNOWN | нет прямого тега месяцев; есть `LeaseTermType` + `PrepayMonths` | UNKNOWN |
| `specialOfferPrice` | UNKNOWN | `BargainPrice` / `BargainAllowed` — близко, не тождественно | UNKNOWN |
| `specialOfferText` | UNKNOWN | `BargainConditions` | UNKNOWN |
| `status` CRM | не публиковать DRAFT/ARCHIVED/PAUSED | не включать в фид, если не ACTIVE | не включать в фид |

### Property → provider

| CRM field | Avito | CIAN | Domclick |
|---|---|---|---|
| `type` APARTMENT/STUDIO/HOUSE | категория автозагрузки | `flatRent` / `houseRent`; STUDIO → `FlatRoomsCount=9` | UNKNOWN |
| `area` | площадь | `TotalArea` | UNKNOWN |
| `rooms` | комнаты | `FlatRoomsCount` | UNKNOWN |
| `floor` | этаж | `FloorNumber` | UNKNOWN |
| `totalFloors` | этажность | `Building.FloorsCount` (обязательно в Building) | UNKNOWN |
| `address` | адрес | `Address` (как Яндекс.Карты) | UNKNOWN |
| `city` | город | часть `Address` | UNKNOWN |
| `district` | UNKNOWN | нет прямого тега в excerpt | UNKNOWN |
| photos | `ImageUrls` | `Photos.FullUrl` | UNKNOWN |
| amenities | нет структурированных amenity flags | набор `HasInternet`, `HasFurniture`, `PetsAllowed`, … | UNKNOWN |
| `bathrooms` | UNKNOWN | `SeparateWcsCount` / `CombinedWcsCount` | UNKNOWN |
| `bedrooms` | нет прямого CIAN-тега; есть `BedsCount` | `BedsCount` | UNKNOWN |
| `ownerPhone` | контакт | `Phones` (до 2 номеров; подмена на стороне CIAN) | UNKNOWN |

### MISSING DOMAIN FIELD (не добавлять сейчас)

| Поле | Зачем |
|---|---|
| `lat` / `lng` | CIAN `Coordinates` |
| `cadastralNumber` | CIAN `CadastralNumber` |
| `livingArea` / `kitchenArea` | CIAN обязательные соотношения площадей |
| `repairType` | CIAN `RepairType` |
| amenity flags (pets, furniture, washer, …) | CIAN boolean-теги |
| `buildingMaterial` / `buildYear` / `ceilingHeight` | CIAN `Building` |
| `parkingType` | CIAN `Parking.Type` (у нас только текст `parkingDescription`) |
| `utilitiesIncluded` | CIAN `UtilitiesTerms` |
| `leaseTermType` | CIAN `fewMonths` \| `longTerm` |
| `prepayMonths` | CIAN `PrepayMonths` |
| публичный абсолютный URL фото | все feed-провайдеры |
| кадастр / точный номер квартиры | CIAN «Проверено в Росреестре» |

Не синхронизировать `Property.monthlyPrice` с провайдером: источник цены LongTerm — `LongTermListing.monthlyPrice`.

---

## 6. Photo requirements

| Требование | Avito Autoload | CIAN XML | Domclick | Текущий PropertyPhoto |
|---|---|---|---|---|
| Transport | URL http(s) или ZIP | URL | UNKNOWN | `url` string, http(s) **или относительный `/...`** |
| Min count | UNKNOWN (шаблон категории) | не указан как min в excerpt | UNKNOWN | 0 |
| Max count | UNKNOWN | **50** | UNKNOWN | нет лимита |
| Formats | изображения в ZIP/URL | JPG, PNG, GIF | UNKNOWN | не валидируется |
| Dimensions | UNKNOWN | ≥200px, ≤10 МБ; рек. 600×800–1024×1024 | UNKNOWN | нет |
| Ordering | порядок URL / имён | порядок + `IsDefault` | UNKNOWN | `sortOrder` + `included` |
| Main photo | первый URL (предположение шаблона — UNKNOWN) | `IsDefault=true` ровно у одного | UNKNOWN | первое included |
| Public access | прямая ссылка, без HTML-обёртки; allowlist IP | скачиваемый FullUrl | UNKNOWN | локальный `/uploads` **не подойдёт** |
| Update | новый набор URL | **новый URL**; тот же URL не обновляет байты | UNKNOWN | mutate same url |

Вывод: архитектура `PropertyPhoto` + `LongTermListingPhoto` **подходит как выбор и порядок**, но **не удовлетворяет** провайдерам, пока URL не публичные, абсолютные, стабильные и сменяемые при замене файла. Storage/CDN на этом этапе не реализовывать.

---

## 7. Authentication

| Provider | Credentials | Где хранить (будущее) | Не делать |
|---|---|---|---|
| Avito | `client_id`, `client_secret`, OAuth access/refresh, `user_id` | Уже: env + encrypted `IntegrationConnection`. LongTerm Autoload может использовать тот же аккаунт, **отдельный publication record** | Не писать секреты в DTO/логи/git. Не reuse STR mock в production (уже запрещён) |
| CIAN | ACCESS KEY; URL фида публичный (не секрет) | Новый encrypted connection **отдельный от Avito**, тот же crypto-модуль | Не класть ключ в XML |
| Domclick | Токен stats/chats ≠ право публиковать. Publication credentials UNKNOWN | Не создавать storage, пока нет официального списка | Не считать stats token publication credential |

CRM authentication по-прежнему обязательна перед production (Stage 7.3.1). Publication Layer это не заменяет.

---

## 8. External IDs

На публикацию (будущее, не схема):

| ID | Смысл |
|---|---|
| `provider` | `AVITO` \| `CIAN` \| `DOMCLICK` |
| `feedItemId` / `clientExternalId` | Наш стабильный id в фиде: рекомендуется `LongTermListing.id` |
| `externalListingId` | Id на стороне провайдера: Avito `AvitoId`, CIAN `offerId` |
| `externalUrl` | URL объявления, если отчёт его вернул |

Запрещено:

- писать LongTerm id в `ChannelListing.externalId`;
- искать LongTerm объявление через short-term ChannelListing;
- один `externalId` на все провайдеры.

Avito дополнительно: не менять Autoload `Id` после первой успешной публикации.

---

## 9. Publication state machine

Предложение для будущего `LongTermPublication.status`. **Enum в Prisma не создаётся.**

```
NOT_PUBLISHED
    → PUBLISHING
        → PUBLISHED
        → ERROR
        → MODERATION_PENDING   (опционально, если провайдер отдаёт очередь)
PUBLISHED
    → UPDATE_PENDING → PUBLISHED | ERROR
    → UNPUBLISHING → UNPUBLISHED | ERROR
ERROR
    → PUBLISHING | UPDATE_PENDING | UNPUBLISHING   (manual retry)
UNPUBLISHED
    → PUBLISHING
```

Правила:

- Состояние живёт на **Publication**, не на `LongTermListing`.
- `LongTermListing.ACTIVE` + `Avito=PUBLISHED`, `CIAN=ERROR`, `Domclick=NOT_PUBLISHED` — допустимо.
- `LongTermListing.ARCHIVED` / `PAUSED` → инициировать unpublish по провайдерам, но ERROR провайдера не откатывает ARCHIVED карточки автоматически без отдельного решения (открытый вопрос).
- Provider rejection / moderation refuse → `ERROR` + `MODERATION_ERROR`, не retry автоматически.
- Feed providers: `PUBLISHING` = фид выложен, ждём отчёт импорта; `PUBLISHED` = отчёт/API подтвердил offer.

---

## 10. Error model

Только архитектура, в код не внедрять.

| Code | Когда | Пример |
|---|---|---|
| `AUTH_ERROR` | 401/403, expired key | CIAN Bearer, Avito token |
| `VALIDATION_ERROR` | Невалидные поля фида/файла | CIAN description & , площадь |
| `PROVIDER_ERROR` | 5xx провайдера, «фид не разобран» | |
| `RATE_LIMIT` | HTTP 429 | CIAN >10 rps |
| `MODERATION_ERROR` | `refusedByModerator`, reject в отчёте | |
| `NETWORK_ERROR` | timeout, DNS, недоступность нашего feed URL | Avito IP allowlist |
| `CONFIGURATION_ERROR` | нет тарифа, фид не зарегистрирован, нет credentials | |
| `UNKNOWN_ERROR` | неклассифицируемое | только после попытки разобрать ответ |

Секреты в `errorMessage` не писать (уже есть `redactSecrets` для Avito).

---

## 11. Retry model

Основано на реальных классах ответов, не на выдуманных кодах провайдера.

| Класс | Retry | Комментарий |
|---|---|---|
| Network / 5xx / timeout | RETRYABLE | exponential backoff; для feed — следующая генерация/poll отчёта |
| HTTP 429 | RETRYABLE | CIAN: снизить rps; Avito: `Retry-After` уже в CRM HTTP-клиенте |
| Validation / 400 field | NON_RETRYABLE | править данные в LongTermListing |
| Moderation rejection | NON_RETRYABLE | ручное исправление + manual retry |
| Expired credentials | NON_RETRYABLE auto | manual reconnect |
| Duplicate / changed feed Id | NON_RETRYABLE | Avito дубль при смене Id |
| Auth 401 после refresh fail | NON_RETRYABLE | reconnect |

Feed-провайдер: «retry create» = **тот же ExternalId/Id в следующем фиде**, не новый id.

---

## 12. Webhook / polling / feed

| Provider | Listing publish status | Рекомендация Stage 8+ |
|---|---|---|
| Avito | WEBHOOK: UNKNOWN. FEED STATUS: SUPPORTED (отчёт автозагрузки). POLLING items: PARTIAL | Feed + poll отчёта/items. Не создавать webhook endpoint без официального метода |
| CIAN | WEBHOOK listing: NOT_SUPPORTED. WEBHOOK chats/moderation messages: SUPPORTED. POLLING import: SUPPORTED. FEED: SUPPORTED | Feed write + poll `get-order` / `get-my-offers` |
| Domclick | WEBHOOK listing: NOT_SUPPORTED (chats webhook ≠ publication). FEED STATUS: UNKNOWN. STATS POLLING: не статус публикации | Сначала закрыть DOCUMENTATION GAP |

MANUAL SYNC: допустим для всех как операторская кнопка «обновить фид / запросить отчёт», не как замена идемпотентности.

---

## 13. Proposed Publication architecture

```
Property  →  LongTermListing  →  Publication (1:N per provider)
                                      ↓
                         ProviderPort (capability-based)
                                      ↓
              ┌─────────────────┬─────────────────┐
              │  FeedAdapter    │  StatusClient   │
              │  generateFeed() │  fetchStatus()  │
              │  publishFeed()  │  mapErrors()    │
              └─────────────────┴─────────────────┘
```

Не делать универсальный обязательный интерфейс:

```
createListing()
updateListing()
publish()
unpublish()
```

Реальные операции:

| Provider | Write | Read |
|---|---|---|
| Avito LongTerm | `generateAutoloadFile()` + размещение URL/upload | `fetchAutoloadReport()` (если API подтвердится) и/или `listItems()` |
| CIAN | `generateCianXml()` + стабильный HTTPS URL | `getOrder()` / `getMyOffers()` |
| Domclick | `generateDomclickXml()` **только после** официальной схемы | stats **не** как publish result |

Short-term Avito `SalesChannelAdapter` **не расширять** методами LongTerm. Новый контур, чтобы не сломать STR.

---

## 14. Provider adapter architecture

Имена — proposal, не код.

```
LongTermPublicationPort
  capabilities(): { feed: boolean; restWrite: boolean; statusApi: boolean }

AvitoAutoloadAdapter
  generateFeed(listings): AutoloadDocument
  # нет createListing()

CianFeedAdapter
  generateFeed(listings): CianXml
  CianStatusClient.pollImport(): ImportReport

DomclickFeedAdapter
  generateFeed(listings): Xml   # blocked until schema GAP closed
  DomclickStatsClient           # отдельно, не publication
```

Idempotency:

- Create = первый успешный импорт с фиксированным `clientExternalId`.
- Update = тот же id в следующем фиде.
- Publish для feed = объект присутствует в фиде.
- Unpublish для Avito = объект отсутствует в файле.
- Unpublish для CIAN = уточнить (GAP), не изобретать `Action=delete`.
- Retry = повтор той же операции с тем же id.

Актуальное состояние feed-провайдера = **последний успешный импорт фида**, сверка с status API если есть.

---

## 15. Database model proposal

**PROPOSAL ONLY. Prisma schema не менять.**

```
LongTermPublication
  id
  listingId              → LongTermListing
  provider               AVITO | CIAN | DOMCLICK
  transport              FEED | API
  status                 NOT_PUBLISHED | PUBLISHING | PUBLISHED | UPDATE_PENDING | UNPUBLISHING | UNPUBLISHED | ERROR
  clientExternalId       String   // Id / ExternalId в фиде
  externalListingId      String?  // AvitoId / offerId
  externalUrl            String?
  lastErrorCode          String?
  lastErrorMessage       String?  // redacted
  lastFeedChecksum       String?
  lastSyncedAt           DateTime?
  unique (listingId, provider)
```

Credentials: не новая plaintext-таблица. Расширить паттерн `IntegrationConnection` (encrypted) на CIAN/Domclick **позже**, без смешения с Avito STR connection без явного решения (один SalesChannel AVITO уже занят short-term).

Не использовать `ChannelListing` и `ExternalBooking` для LongTerm publication.

---

## 16. Open questions

1. Нужен ли отдельный Avito OAuth scope / приложение для Autoload reports API (каталог не прочитан)?
2. Может ли `GET /core/v1/items` надёжно отличить long-term item от short-term?
3. CIAN: исключение `Object` из фида = unpublish или объявление «зависает» до конца 7-дневного срока?
4. Domclick: одна XML-схема для аренды вторички или только новостройки/продажа?
5. Публичный hosting фида и фото: отдельный Stage storage?
6. PAUSED/ARCHIVED LongTermListing: ждать unpublish всех провайдеров или архивировать карточку сразу?
7. Нужен ли CIAN `SubAgent` / телефон объекта vs `ownerPhone`?
8. `commission` CRM vs `ClientFee` CIAN (разный смысл).
9. Нужно ли включать short-term Avito listings в тот же Autoload-файл (нет: смешает контуры).

---

## 17. Documentation gaps

Помечено **DOCUMENTATION GAP** — не выдумывать API.

1. **Avito** live OpenAPI STR / Item / Autoload (`developers.avito.ru/api-catalog/*`) — captcha/IP; нет подтверждённого REST create/update/unpublish для long-term.
2. **Avito** шаблон категории «Недвижимость / аренда квартир» (`/autoload/documentation/templates/...`) — captcha; точные имена параметров (цена, залог, фото-лимиты) не зафиксированы.
3. **Avito** webhook смены статуса объявления — не подтверждён.
4. **Avito** числовые rate limits каталога — не прочитаны.
5. **CIAN** live https://www.cian.ru/xml_import/doc/ и HelpDesk XML — captcha; использован официальный снимок той же документации. Перед реализацией сверить live-версию.
6. **CIAN** точная семантика unpublish при удалении объекта из фида.
7. **Domclick** XML-схема аренды, обязательные поля, фото, ExternalId, unpublish — help/validation за WAF.
8. **Domclick** publication REST methods — не найдены.
9. **Domclick** соответствие stats `offer_id` идентификатору фида.

---

## 18. Stage 8 implementation plan

Порядок **после** закрытия GAP. На Stage 8.0 **не начинать**.

1. **Не трогать** short-term Avito: ChannelListing, STR bookings, occupancy.
2. Storage фото: публичные HTTPS URL (иначе ни один feed не заработает стабильно).
3. **CIAN first** (самая полная официальная write-схема): генерация `flatRent` XML, стабильный URL, poll `get-order` / `get-my-offers`. Модель Publication — только когда начнётся реализация.
4. **Avito Autoload second**: генерация файла, `Id=listing.id`, не смешивать со STR adapter; отчёт из ЛК/API когда GAP закрыт.
5. **Domclick last**: только после официальной схемы аренды. Не использовать Statistics API как публикацию.
6. UI статусов per provider на карточке LongTermListing; `LongTermListing.status` не копировать с провайдера.
7. CRM auth — блокер production, не блокер проектирования Publication.

Acceptance Stage 8.0:

- [x] Avito audited
- [x] CIAN audited
- [x] Domclick audited
- [x] официальные источники
- [x] capability matrix
- [x] UNKNOWN ≠ SUPPORTED
- [x] ShortTerm / LongTerm разделены
- [x] ChannelListing не для LongTerm
- [x] external IDs разделены
- [x] photo requirements
- [x] authentication requirements
- [x] publication statuses
- [x] retry strategy
- [x] error model
- [x] webhook/feed/API per provider
- [x] documentation gaps явные
- [x] Prisma schema не изменена
- [x] код публикации не написан
- [x] Stage 8 implementation не начат
