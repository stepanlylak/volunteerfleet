# Епік: Флов статусів автомобілів (Vehicle Status Flow)

> **Статус:** Proposed (готовий до декомпозиції в спринти)
> **Тип:** Епік / зміна бізнес-логіки
> **Зачіпає:** `apps/server`, `apps/client`, `packages/shared`, схему БД
> **Залежність:** Виконується **після** завершення епіку Organizations & Multitenancy
> **Мова документа:** українська (наратив), англійська (ідентифікатори, таблиці, колонки, enum'и) — за правилами проєкту.

Цей документ — єдине джерело правди для епіку. Він навмисно детальний, щоб інший розробник або
AI-агент міг реалізувати будь-який тікет без додаткового контексту.

---

## 1. Контекст і проблема

Зараз статуси автомобілів зберігаються у довідниковій таблиці `vehicle_statuses` з можливістю
CRUD через адмін-панель. Зміна статусу — просте оновлення `vehicles.statusId` через загальний
`PATCH /vehicles/:id`. Історія зберігає лише `oldStatusId`/`newStatusId`/`note`.

**Проблеми:**

1. **Статуси не повинні бути довідником** — вони є фіксованою частиною бізнес-логіки з чітким
   флоу переходів. Користувач не повинен мати можливість створювати/видаляти/перейменовувати статуси.
2. **Немає флоу переходів** — можна встановити будь-який статус у будь-який момент без валідації.
3. **Немає додаткових даних при зміні статусу** — кожен перехід потребує специфічних полів
   (ціна покупки, документи, чекбокси, нотатки).
4. **Немає системи алертів** — користувач не бачить, які обов'язкові дії ще не виконані для авто.
5. **Документи не типізовані** — немає розрізнення між техпаспортом, митною декларацією, актом тощо.

## 2. Мета і нефункціональні вимоги

**Мета.** Замінити вільну зміну статусів на структурований флов з валідацією переходів,
збором додаткових даних на кожному етапі та системою алертів для незакритих питань.

**Нефункціональні вимоги:**

- **Цілісність даних** — перехід між статусами валідується на бекенді; неможливі переходи
  відхиляються з помилкою.
- **Гнучкість** — додаткові поля при переході не є обов'язковими (крім самого статусу),
  але їх відсутність генерує алерти.
- **Зворотна сумісність з org-епіком** — `vehicle_status_history` зберігає `organization_id`;
  `orgScope` застосовується до всіх нових запитів.

## 3. Зафіксовані рішення (конституція епіку)

1. **Статуси — Postgres enum `vehicle_status`, не довідникова таблиця.** Таблиця `vehicle_statuses`
   видаляється повністю разом з CRUD-ендпоінтами та фронтенд-сторінкою довідників статусів.
2. **Перелік статусів (enum `vehicle_status`):**
   - `new` — Нове (початковий, при створенні авто)
   - `paid` — Оплачено
   - `in_transit` — В дорозі
   - `arrived` — Прибуло
   - `in_repair` — На ремонті
   - `ready` — Готове
   - `transferred` — Передано
   - `returned` — Повернено
   - `lost` — Втрачено
3. **Кольори та UI-мета — константи на фронтенді**, не в БД. Об'єкт `VEHICLE_STATUS_CONFIG`
   у `packages/shared` містить: `label` (uk), `color`, `sortOrder`).
4. **Флов переходів валідується на бекенді.** Матриця дозволених переходів — константа в shared.
5. **При створенні авто статус `new` виставляється автоматично**, клієнт не передає `statusId`.
6. **Зміна статусу — окремий ендпоінт** `POST /vehicles/:id/transition` (не через загальний PATCH).
7. **`vehicle_status_history` розширюється** додатковими nullable-полями для даних переходу.
8. **Документи отримують enum `document_type`** для типізації (техпаспорт, митна декларація тощо).
9. **Алерти — обчислювані на льоту**, не зберігаються в БД. Бекенд повертає масив алертів у
   відповіді авто на основі поточного статусу та наявних даних/документів.
   *Архітектурне рішення:* Використання Postgres Views (віртуальних таблиць) для централізації логіки алертів на рівні БД. Це дозволяє ефективно отримувати алерти як для одного авто, так і для фільтрації в списках.
10. **Greenfield-підхід до міграцій** — аналогічно org-епіку, живих даних немає.
11. **Перехід, rollback і редагування історії є конкурентно безпечними.** Операції виконуються
    в транзакції з блокуванням рядка авто (`SELECT ... FOR UPDATE`) або еквівалентним optimistic
    compare-and-swap. Конфлікт через паралельну зміну статусу повертає `409 Conflict`.
12. **Transition request валідується на бекенді як strict discriminated union за `targetStatus`.**
    Кожна гілка приймає лише поля відповідного переходу; невідомі поля та поля іншого статусу
    відхиляються, а не мовчки видаляються парсером.
13. **Дані ціни покупки використовують чинну multi-currency модель:** сума, валюта, збережений курс
    до UAH та джерело курсу (`default` або `manual`). Кастомний курс підтримується так само, як у витратах.

## 4. Флов переходів статусів

### Стандартний флов

```
new → paid → in_transit → arrived → in_repair → ready → transferred
```

### Додаткові переходи

```
transferred → returned     (повернення авто)
returned → in_repair       (повторний ремонт після повернення)
returned → transferred     (повторна передача, потрібні НОВІ акти)
in_repair → ready          (після ремонту — знову готове)
ready → transferred        (передача після ремонту, можна брати існуючі акти якщо отримувач не змінився)
transferred → in_repair    (відправка на ремонт без формального повернення)
paid → arrived             (лише якщо перехід → paid має is_local_purchase = true)

Будь-який активний статус → lost  (втрата авто, з будь-якого стану крім lost)
```

### 4.2. Матриця дозволених переходів

| Поточний статус | Дозволені переходи                     |
| --------------- | -------------------------------------- |
| `new`           | `paid`, `lost`                         |
| `paid`          | `in_transit`, `arrived`*, `lost`       |
| `in_transit`    | `arrived`, `lost`                      |
| `arrived`       | `in_repair`, `ready`, `lost`           |
| `in_repair`     | `ready`, `lost`                        |
| `ready`         | `transferred`, `lost`                  |
| `transferred`   | `returned`, `in_repair`, `lost`        |
| `returned`      | `in_repair`, `transferred`, `lost`     |
| `lost`          | _(термінальний стан, без переходів)_   |

\* `paid → arrived` дозволено лише для локальної покупки.

### Дані при переходах

| Перехід         | Додаткові поля                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------- |
| → `paid`        | `purchasePrice`, `purchaseCurrency`, `purchaseRate`, `purchaseRateSource` — ціна первинної покупки (інформативно, НЕ потрапляє у витрати); `isLocalPurchase` (bool, request default false); `registrationDocId` (uuid, null) — техпаспорт |
| → `in_transit`  | `customsDeclarationDocId` (uuid, null) — митна декларація; для локальної покупки цей статус можна оминути |
| → `arrived`     | `registrationDocId` (uuid, null) — техпаспорт; `stampedCustomsDeclarationDocId` (uuid, null) — скан митної з печатками |
| → `in_repair`   | `repairNote` (text, null) — де на ремонті, інфо                                                  |
| → `ready`       | `transferActDraftDocId` (uuid, null) — акт приймання-передачі (заповнений, не підписаний)         |
| → `transferred` | `transferActSignedDocId` (uuid, null) — підписаний акт; `isRegisteredAtServiceCenter` (bool, default false) |
| → `returned`    | `returnActDocId` (uuid, null) — акт повернення                                                   |
| → `lost`        | `lostReason` (text, NOT NULL) — причина втрати (обов'язкове поле)                                 |

**Спільне для всіх переходів:**
- `transitionDate` (date, default = дата попереднього переходу або дата створення для `new`)
- `note` (text, null) — необов'язковий коментар

**Ціна покупки:**
- поля `purchasePrice`, `purchaseCurrency`, `purchaseRate`, `purchaseRateSource` передаються групою:
  або всі відсутні, або всі заповнені;
- `purchaseCurrency ∈ {UAH, USD, EUR}`; для UAH `purchaseRate = 1`;
- `purchaseRate` автоматично отримується через `ExchangeRatesService` за `transitionDate`, але може
  бути змінений користувачем; тоді `purchaseRateSource = manual`;
- UI використовує спільний компонент полів суми/валюти/курсу з формою витрати, без дублювання логіки.

`isLocalPurchase` зберігається лише в записі переходу `→ paid`. За поточною матрицею авто не може
повернутися до `paid`, тому такий запис для авто є максимум один і однозначно описує спосіб покупки.
Він використовується для митних алертів і є обов'язковою умовою прямого переходу `paid → arrived`.
`VehicleResponse.isLocalPurchase` за потреби повертається як обчислюване nullable-поле з цього
transition (`null` до появи `→ paid`), але окрема колонка на `vehicles` не створюється.

### 4.3. Коригування історії та ролі

Система дозволяє виправляти помилки в історії статусів:

1. **Видалення останнього статусу (Rollback):**
   - Дозволено для виправлення помилкових дій (наприклад, випадкового переведення в `lost`).
   - Видаляє останній запис в `vehicle_status_history` та відкочує `vehicles.status` до значення `old_status` з видаленого запису.
   - Видалення можливе для будь-якого останнього статусу, КРІМ початкового статусу `new`.
   - Після видалення запису про зміну статусу, авто автоматично повертається у попередній активний статус.

2. **Редагування даних переходу:**
   - Користувачі з ролями `coordinator` і `volunteer` можуть **редагувати** дані будь-якого переходу
     (додавати/замінювати документи, змінювати нотатки, дату та специфічні дані переходу), якщо вони
     були пропущені або введені помилково.
   - Волонтери НЕ можуть видаляти записи історії або змінювати сам статус заднім числом.
   - Дозволені поля визначаються значенням `new_status` запису; `old_status`, `new_status`,
     `changed_by` та системні timestamps не редагуються.
   - Зміна `transitionDate` не може порушити хронологію: дата має бути не раніше попереднього і
     не пізніше наступного переходу.

## 5. Система алертів

Алерти обчислюються на бекенді на основі поточного стану авто та прикріплених документів/даних.
Повертаються як масив у відповіді vehicle (`alerts: VehicleAlert[]`).

| Алерт                                 | Умова                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `missing_registration_doc`            | Статус у `paid/in_transit/arrived/in_repair/ready/transferred/returned` і техпаспорт не прикріплений |
| `missing_customs_declaration`         | Статус у `in_transit/arrived/in_repair/ready/transferred/returned`, покупка не локальна, декларація відсутня |
| `missing_stamped_customs_declaration` | Статус у `arrived/in_repair/ready/transferred/returned`, покупка не локальна, скан з печатками відсутній |
| `missing_transfer_act_draft`          | Статус у `ready/transferred` і актуальна чернетка акту не прикріплена          |
| `missing_transfer_act_signed`         | Статус = `transferred` і підписаний акт не прикріплений (якщо перехід був з `returned`, новий акт обов'язковий) |
| `not_registered_at_service_center`    | Статус = `transferred` і `isRegisteredAtServiceCenter = false`                |
| `missing_return_act`                  | Статус = `returned` і акт повернення не прикріплений                          |

### Алерти — обчислювані на льоту (Postgres Views)

Алерти обчислюються на рівні бази даних через View `vehicle_alerts_view`. Це дозволяє:
- Уніфікувати логіку алертів для `GET /vehicles/:id` та `GET /vehicles` (фільтрація).
- Забезпечити високу продуктивність (SQL joins vs JS loops).
- Легко додавати нові типи алертів без зміни коду сервісів.

**Схема View `vehicle_alerts_view`:**
- `vehicle_id` (uuid)
- `type` (string enum)
- `severity` ('warning' | 'error')
- `message` (text)

**Логіка (SQL CASE/WHEN):**
- Бізнес-етапи задаються явними `status IN (...)`, а не порівняннями Postgres enum через
  `status >= ...`. Enum має технічний порядок оголошення, але флов містить цикли та термінальний
  `lost`, тому ordinal-порівняння не відображає бізнес-семантику.
- `missing_registration_doc`: `status IN (...)` з таблиці вище та немає активного
  (`deleted_at IS NULL`) техпаспорта, прикріпленого до переходу цього авто.
- `missing_customs_declaration`: відповідний `status IN (...)`, запис `→ paid` має
  `is_local_purchase = false` та немає активної митної декларації.
- `missing_transfer_act_signed`: перевіряється FK документа саме на останньому актуальному переході
  `→ transferred`, а не наявність будь-якого старого документа цього типу на авто. Після
  `returned → transferred` новий transition мусить посилатися на новий акт; після циклу ремонту
  дозволено повторно послатися на чинний існуючий акт.
- (аналогічно для інших типів з розділу 5)
- View не повертає алерти для soft-deleted авто й не враховує soft-deleted документи. Усі зв'язки
  обмежені `organization_id`, щоб дані іншої організації не могли закрити алерт.

---

## 6. Модель даних

### Новий enum

**`vehicle_status`** (Postgres enum):
`new`, `paid`, `in_transit`, `arrived`, `in_repair`, `ready`, `transferred`, `returned`, `lost`

### Новий enum

**`document_type`** (Postgres enum):
`registration_certificate`, `customs_declaration`, `stamped_customs_declaration`,
`transfer_act_draft`, `transfer_act_signed`, `return_act`, `other`

### Зміни таблиць

**`vehicles`:**
- `statusId uuid NOT NULL → vehicleStatuses.id` **замінюється на** `status vehicle_status NOT NULL DEFAULT 'new'`
- Видаляється індекс `vehicles_status_id_idx`, додається `vehicles_status_idx`

**`vehicle_status_history`** — розширення:
- `old_status_id`/`new_status_id` (uuid FK) **замінюються на** `old_status vehicle_status NULL` / `new_status vehicle_status NOT NULL`
- Додаються nullable-колонки:
  - `purchase_price numeric(14,2)` — ціна покупки (при переході → paid)
  - `purchase_currency currency_code` — валюта ціни покупки
  - `purchase_rate numeric(14,6)` — зафіксований курс до UAH
  - `purchase_rate_source rate_source` — `default` або `manual`
  - `is_local_purchase boolean` — ознака локальної покупки (тільки при → paid; для інших переходів NULL)
  - `repair_note text` — інфо про ремонт (при → in_repair)
  - `is_registered_at_service_center boolean` — чекбокс реєстрації (при → transferred)
  - `lost_reason text` — причина втрати (при → lost)
  - `transition_date date NOT NULL DEFAULT CURRENT_DATE`
- Документи при переходах прикріплюються як звичайні `documents` з відповідним `document_type` і `vehicle_id`; їх id'шники зберігаються в `vehicle_status_history` як nullable FK:
  - `registration_doc_id uuid NULL → documents.id`
  - `customs_declaration_doc_id uuid NULL → documents.id`
  - `stamped_customs_declaration_doc_id uuid NULL → documents.id`
  - `transfer_act_draft_doc_id uuid NULL → documents.id`
  - `transfer_act_signed_doc_id uuid NULL → documents.id`
  - `return_act_doc_id uuid NULL → documents.id`
- Partial unique index гарантує не більше одного запису `→ paid` на авто:
  `UNIQUE (vehicle_id) WHERE new_status = 'paid'`. Значення `isLocalPurchase`, пропущене у paid
  request, нормалізується сервісом до `false`; DB default на всій колонці не використовується,
  щоб інші типи переходів зберігали `NULL`.

Поточна FK-модель свідомо залишається простою, бо на один transition передбачено не більше одного
документа кожного типу. Кожен повторний перехід має власний рядок історії та власні FK, тому старий
і новий акти не змішуються, якщо алерти читають FK актуального transition. Перевірка лише за
`documents.vehicle_id + document_type` недостатня: вона може помилково прийняти старий акт за
документ нової передачі. Окрема junction-таблиця `vehicle_status_history_documents` знадобиться,
лише якщо з'явиться вимога кількох документів одного типу на один transition або довільних нових
типів без зміни схеми history.

**`documents`:**
- Додається `document_type document_type NOT NULL DEFAULT 'other'`

### Таблиця `vehicle_statuses` — ВИДАЛЯЄТЬСЯ

Разом з нею видаляються:
- CRUD-ендпоінти `/api/v1/dictionaries/vehicle-statuses`
- `VehicleStatusesService`, `VehicleStatusesController`
- Shared-схеми: `vehicleStatusCreateSchema`, `vehicleStatusUpdateSchema`, `vehicleStatusSchema`
- Enum `vehicle_status_kind`
- Фронтенд: секція статусів на сторінці довідників
- Dashboard і shared dashboard schema (`statusId/statusName/kind` → enum status + shared config)
- Reports та public vehicle API, які зараз очікують relation до `vehicle_statuses`
- `seed-demo.ts` і тестові fixtures, які зараз шукають статуси за id/назвою

## 7. API

### Нові ендпоінти

**`POST /api/v1/vehicles/:id/transition`**

Request body:
```json
{
  "expectedCurrentStatus": "new",
  "targetStatus": "paid",
  "transitionDate": "2025-01-15",
  "note": "Оплачено через PayPal",
  "purchasePrice": 5000.00,
  "purchaseCurrency": "USD",
  "purchaseRate": 41.25,
  "purchaseRateSource": "manual",
  "isLocalPurchase": false,
  "registrationDocId": "uuid-or-null"
}
```

Приклад показує гілку `targetStatus = paid`. Інші статуси мають окремі форми request body.
Shared Zod schema реалізується через `z.discriminatedUnion('targetStatus', [...])`: це і є
бекенд-валідація контракту. Кожна гілка є strict object, тому поля іншого переходу не ігноруються,
а повертають validation error.

Валідація:
1. Перехід `currentStatus → targetStatus` є в матриці дозволених.
2. `lostReason` обов'язковий якщо `targetStatus = lost`.
3. Документи (якщо передані) належать тому ж авто і мають відповідний `document_type`.
4. `transitionDate` не раніше дати попереднього переходу.
5. `paid → arrived` дозволено лише якщо запис історії `→ paid` має `is_local_purchase = true`.
6. `expectedCurrentStatus` має збігатися з поточним статусом заблокованого рядка авто; якщо статус
   уже змінив інший запит, повертається `409`.
7. Поля ціни покупки або всі відсутні, або всі валідні; для UAH курс дорівнює `1`.
8. Для `returned → transferred` переданий `transferActSignedDocId` не може збігатися з актом
   попередньої передачі; якщо акт не переданий, перехід дозволяється, але створюється алерт.

Response: `VehicleResponse` (оновлений, з алертами).

**`DELETE /api/v1/vehicles/:id/status-history/last`**

Відкочує останню зміну статусу.
- Доступ: Тільки `coordinator`, не `volunteer`.
- Query містить `expectedLastHistoryId`; якщо після відкриття UI з'явився новіший перехід,
  операція нічого не видаляє і повертає `409`.
- Обмеження: Не можна видалити єдиний (початковий) статус `new`.
- Логіка: у транзакції блокує авто, видаляє останній запис історії та повертає статус авто до
  попереднього. Якщо відкочується `→ paid`, ознака локальної покупки зникає разом із цим записом;
  окремої синхронізації `vehicles` не потрібно. Прикріплені документи не видаляються автоматично.

**`PATCH /api/v1/vehicles/:id/status-history/:historyId`**

Редагує дані існуючого переходу без зміни `oldStatus`/`newStatus`.
- Доступ: `@OrgRoles(coordinator, volunteer)`.
- Body містить незмінний discriminator `transitionStatus` і є strict discriminated union за ним;
  `transitionStatus` повинен збігатися з фактичним `new_status` запису.
- Дозволяє змінювати специфічні поля переходу, `note`, `transitionDate` і document FK.
- Перевіряє хронологію сусідніх переходів, належність/тип/активність документів та `orgScope`.
- Операція виконується конкурентно безпечно в транзакції.

### Зміни в існуючих ендпоінтах

- **`POST /vehicles`** — прибирається `statusId` з body; статус `new` виставляється автоматично.
- **`PATCH /vehicles/:id`** — прибирається можливість змінювати `statusId`/`status` через цей ендпоінт.
- **`GET /vehicles/:id`** — додається поле `alerts: VehicleAlert[]` у відповідь.
- **`GET /vehicles`** — фільтр `statusId` замінюється на `status` (string enum).
- **`GET /vehicles/:id/status-history`** — відповідь розширюється додатковими полями з історії.

## 8. Фронтенд

### Константи статусів (`packages/shared`)

```typescript
export const VEHICLE_STATUSES = [
  'new', 'paid', 'in_transit', 'arrived',
  'in_repair', 'ready', 'transferred', 'returned', 'lost',
] as const;
export type VehicleStatus = typeof VEHICLE_STATUSES[number];

export const VEHICLE_STATUS_CONFIG: Record<VehicleStatus, {
  label: string;
  color: string;
  sortOrder: number;
}> = {
  new:          { label: 'Нове',        color: '#1677ff', sortOrder: 10 },
  paid:         { label: 'Оплачено',    color: '#faad14', sortOrder: 20 },
  in_transit:   { label: 'В дорозі',    color: '#722ed1', sortOrder: 30 },
  arrived:      { label: 'Прибуло',     color: '#13c2c2', sortOrder: 40 },
  in_repair:    { label: 'На ремонті',  color: '#ff7a45', sortOrder: 50 },
  ready:        { label: 'Готове',      color: '#52c41a', sortOrder: 60 },
  transferred:  { label: 'Передано',    color: '#389e0d', sortOrder: 70 },
  returned:     { label: 'Повернено',   color: '#eb2f96', sortOrder: 80 },
  lost:         { label: 'Втрачено',    color: '#ff4d4f', sortOrder: 90 },
};
```

### UI зміни

1. **Модалка переходу статусу** — замість дропдауну на формі авто; показує тільки дозволені
   наступні статуси; динамічна форма з полями, специфічними для обраного переходу.
2. **Алерти у історії статусів** — попередженнями (Ant Design `Alert`) про незакриті питання.
3. **Покращена історія статусів** — таймлайн з деталями кожного переходу (ціна, документи, нотатки, алерти).
4. **Фільтр по статусу** — замість дропдауну з довідника, виводимо з enum-констант.
5. **Видалення секції статусів з довідників** — сторінка `/admin/dictionaries` більше не показує статуси.

## 9. Взаємодія з org-епіком

### Сумісність

Цей епік **не конфліктує** з org-епіком за умови послідовного виконання (org → status flow):

1. **`vehicle_statuses` таблиця** — org-епік позначає довідники як "shared, без `organization_id`"
   (Out of scope п.3). Наш епік видаляє цю таблицю повністю — це менше залежностей, а не більше.
2. **`vehicle_status_history.organization_id`** — додано в org-епіку. Наш епік розширює цю таблицю
   додатковими полями, зберігаючи `organization_id`.
3. **`orgScope`** — новий ендпоінт `POST /vehicles/:id/transition` має використовувати `orgScope`
   та `@OrgRoles(coordinator, volunteer)`.
4. **Міграції** — greenfield-підхід зберігається; єдина початкова міграція регенерується.

### Що org-епік створює, що ми використовуємо

- `organization_id` на `vehicles`, `vehicle_status_history`, `documents`
- `OrgRolesGuard`, `@OrgRoles`, `orgScope`
- Cookie-only auth, `activeOrgId` у JWT

## 10. Поза обсягом (Out of scope)

- Автоматичне створення витрат з `purchasePrice` — ціна зберігається лише як історичний запис.
- Нотифікації про алерти (email/push).
- Массові зміни статусів (bulk transition).
- Кастомні статуси per-org.
- Workflow engine / BPMN — валідація переходів реалізується простою матрицею.
- Автоматичне визначення переходу при завантаженні документа.

## 11. Тікети

Кожен тікет ≈ один PR. Формат: **Мета / Обсяг / Критерії приймання / Залежності**.

### Фаза 0 — Фундамент

#### VSF-1 — Enum `vehicle_status` + константи + shared-типи

- **Мета.** Захардкодити статуси як enum замість довідника.
- **Обсяг.** Postgres enum `vehicle_status` у Drizzle-схемі; `VEHICLE_STATUSES`, `VehicleStatus`,
  `VEHICLE_STATUS_CONFIG` у `packages/shared`; матриця дозволених переходів `ALLOWED_TRANSITIONS`
  у shared; Zod-схеми для transition request/response як strict discriminated union за `targetStatus`.
  Прибрати `vehicleStatusKindEnum` з `enums.ts`; додати unit-тести матриці та status-specific schemas.
- **Критерії приймання.** Типи експортуються зі `shared`; поля іншого переходу відхиляються;
  `pnpm -w typecheck` і тести зелені.
- **Залежності.** Org-епік завершено.

#### VSF-2 — Enum `document_type` + розширення documents

- **Мета.** Типізувати документи для зв'язку зі статусами.
- **Обсяг.** Postgres enum `document_type` у Drizzle-схемі; колонка `document_type` на `documents`
  (default `other`); оновити shared-типи документів; оновити create/update schemas.
- **Критерії приймання.** Документи мають тип; існуючий CRUD працює з `document_type = other` за замовчуванням.
- **Залежності.** VSF-1.

#### VSF-3 — Міграція vehicles: `statusId` → `status` enum

- **Мета.** Замінити FK на довідник enum-колонкою.
- **Обсяг.** `vehicles.status vehicle_status NOT NULL DEFAULT 'new'`; видалити `vehicles.statusId`
  і `vehicles_status_id_idx`; оновити shared vehicle schemas (`statusId` → `status`);
  оновити vehicle response/create/update/list schemas.
- **Критерії приймання.** `vehicles` використовує enum; typecheck зелений.
- **Залежності.** VSF-1.

#### VSF-4 — Розширення `vehicle_status_history`

- **Мета.** Зберігати додаткові дані при кожному переході.
- **Обсяг.** Замінити `old_status_id`/`new_status_id` на `old_status`/`new_status` (enum);
  додати всі nullable-колонки з розд. 6 (`purchase_price`, `purchase_currency`, `purchase_rate`,
  `purchase_rate_source`, `is_local_purchase`, `repair_note`,
  `is_registered_at_service_center`, `lost_reason`, `transition_date`, document FK'и) та DB checks
  для узгодженості валютної групи; додати partial unique index для одного `→ paid` на авто;
  оновити shared-типи та Zod-схеми історії.
- **Критерії приймання.** Схема відповідає розд. 6; typecheck зелений.
- **Залежності.** VSF-1, VSF-2, VSF-3.

#### VSF-5 — Видалення `vehicle_statuses` таблиці + reset міграцій

- **Мета.** Прибрати довідник статусів повністю.
- **Обсяг.** Видалити таблицю `vehicle_statuses` зі схеми; видалити `VehicleStatusesService`,
  `VehicleStatusesController`; прибрати зі `shared` (`vehicleStatusCreateSchema`,
  `vehicleStatusUpdateSchema`, `vehicleStatusSchema`, `VEHICLE_STATUS_KINDS`);
  видалити `vehicleStatusKindEnum`; регенерувати міграцію; оновити seeds
  (прибрати `seedVehicleStatuses`, `SEED_VEHICLE_STATUS_IDS`); перевести `DashboardService`,
  dashboard shared schemas/UI, `ReportsService`, public vehicle API, `seed-demo.ts` і fixtures
  з relation/id-моделі на enum + `VEHICLE_STATUS_CONFIG`.
- **Критерії приймання.** Жодних runtime-згадок таблиці `vehicle_statuses`, `statusId` чи
  `vehicleStatusKind`; dashboard/reports/public API/demo seed працюють; `db:migrate && db:seed`
  і білд зелені.
- **Залежності.** VSF-3, VSF-4.

### Фаза 1 — Бізнес-логіка

#### VSF-6 — Ендпоінт `POST /vehicles/:id/transition`

- **Мета.** Реалізувати зміну статусу з валідацією та збереженням даних.
- **Обсяг.** `VehicleTransitionService` — валідація матриці переходів, збереження в
  `vehicle_status_history` з додатковими полями, оновлення `vehicles.status`;
  `VehiclesController.transition()`; Zod-валідація body; `@OrgRoles(coordinator, volunteer)`;
  orgScope; перевірка що документи (якщо передані) належать тому ж авто та мають правильний
  `document_type`; обов'язковий `expectedCurrentStatus`; транзакція з row lock/compare-and-swap;
  `paid → arrived` лише для локальної покупки; підтримка default/manual purchase rate через
  `ExchangeRatesService`; заборона повторного використання старого підписаного акту після
  `returned`; інтеграційні тести валідних/невалідних і паралельних переходів.
- **Критерії приймання.** Неможливий перехід → 400; `lostReason` обов'язковий для `lost`;
  конкурентна зміна → 409; перехід зберігається в історію з усіма даними; orgScope дотримується;
  два одночасні переходи не створюють розгалужену історію.
- **Залежності.** VSF-5.

#### VSF-16 — Редагування даних переходу

- **Мета.** Дозволити доповнювати або виправляти дані існуючого переходу без зміни статусного флову.
- **Обсяг.** `PATCH /vehicles/:id/status-history/:historyId`; status-specific Zod schema за
  immutable discriminator `transitionStatus`, який має збігатися з фактичним `new_status`;
  редагування дозволених полів, документів, нотатки й дати; перевірка
  хронології сусідніх записів, document type/ownership/soft-delete, `orgScope`;
  `@OrgRoles(coordinator, volunteer)`; транзакція з блокуванням авто; інтеграційні тести.
- **Критерії приймання.** Дані переходу редагуються без зміни `old_status/new_status`; поля іншого
  статусу відхиляються; хронологію не можна зламати; документи іншого авто/org або видалені
  документи відхиляються.
- **Залежності.** VSF-6.

#### VSF-7 — Автоматичний статус `new` при створенні + прибрати `statusId` з create/update

- **Мета.** Статус виставляється автоматично і змінюється лише через transition.
- **Обсяг.** `vehicles.create()` — статус `new` автоматично; прибрати `statusId` з
  `vehicleCreateSchema`; прибрати зміну статусу з `vehicles.update()`; `vehicleUpdateSchema`
  без `statusId`/`status`.
- **Критерії приймання.** Створення авто → статус `new`; PATCH не змінює статус; старий флов
  зміни статусу через PATCH не працює.
- **Залежності.** VSF-6.

#### VSF-8 — Обчислення алертів (Backend)

- **Мета.** Бекенд повертає актуальні алерти для кожного авто, використовуючи SQL View.
- **Обсяг.**
  - Створити міграцію з Postgres View `vehicle_alerts_view` згідно з логікою в розд. 5.
  - Описати View в Drizzle ORM (через `pgView`).
  - `VehicleAlertService` — отримання алертів з View.
  - Додати `alerts` у `VehicleResponse`.
  - Додати фільтрацію `hasAlerts` в `GET /vehicles` (через join з View або `EXISTS`).
  - Використовувати явні status sets замість ordinal-порівняння enum; враховувати тільки активні
    авто/документи в поточній org; для циклічних переходів перевіряти актуальний transition.
  - Додати тести View для `lost`, `returned`, повторної передачі, циклу ремонту, soft-delete та org isolation.
- **Критерії приймання.** Алерти повертаються у відповіді авто; фільтрація за алертами працює;
  старий акт не закриває алерт нової передачі після повернення; продуктивність запитів стабільна.
- **Залежності.** VSF-6.

### Фаза 2 — Фронтенд

#### VSF-9 — Модалка переходу статусу

- **Мета.** UI для зміни статусу з динамічною формою.
- **Обсяг.** `StatusTransitionModal` — показує дозволені переходи; динамічні поля залежно від
  обраного статусу; завантаження документів з правильним `document_type`; поле дати переходу
  (default = дата попереднього переходу); кнопка «Змінити статус» на картці авто; винести
  amount/currency/rate/rate source в перевикористовуваний компонент і застосувати його також
  у формі витрати.
- **Критерії приймання.** Перехід працює end-to-end; поля відповідають специфікації; дата
  за замовчуванням правильна.
- **Залежності.** VSF-6, VSF-7.

#### VSF-10 — Алерти на картці авто

- **Мета.** Відображати попередження про незакриті питання.
- **Обсяг.** Блок алертів на `VehicleCardPage` (Ant Design `Alert`); іконка-індикатор
  алертів у списку авто; фільтр «З алертами» у списку.
- **Критерії приймання.** Алерти відображаються відповідно до стану авто; можна фільтрувати
  авто з алертами.
- **Залежності.** VSF-8, VSF-9.

#### VSF-11 — Покращена історія статусів

- **Мета.** Деталізований таймлайн з даними кожного переходу.
- **Обсяг.** Рефактор компонента історії: таймлайн (Ant Design `Timeline`); для кожного
  переходу показувати додаткові дані (ціна, документи як посилання, нотатки, дата);
  кольори за статусом з `VEHICLE_STATUS_CONFIG`; дія редагування відкриває status-specific форму
  та викликає endpoint з VSF-16.
- **Критерії приймання.** Історія показує всі дані переходу; документи клікабельні; coordinator
  і volunteer можуть доповнити дозволені дані без зміни статусів.
- **Залежності.** VSF-9, VSF-16.

#### VSF-12 — Оновлення фільтрів та довідників

- **Мета.** Прибрати статуси з довідників, оновити фільтри.
- **Обсяг.** Видалити секцію статусів зі сторінки довідників; фільтр статусу у списку авто —
  чекбокси з `VEHICLE_STATUS_CONFIG`; оновити форму створення авто (без `statusId`);
  оновити форму редагування авто (без зміни статусу).
- **Критерії приймання.** Довідники не містять статусів; фільтри працюють з enum; форми
  не показують поле статусу.
- **Залежності.** VSF-9.

### Фаза 3 — Стабілізація

#### VSF-13 — Тести

- **Мета.** Додати наскрізну регресію поверх тестів, що вже входять до відповідних implementation tickets.
- **Обсяг.** End-to-end сценарії повного флову, локальної покупки, повернення і повторної передачі,
  циклу ремонту, rollback, редагування історії, конкурентних запитів, org isolation; тести що
  загальний `PATCH /vehicles/:id` не змінює статус.
- **Критерії приймання.** Тести зелені в CI.
- **Залежності.** Фази 0–2.

#### VSF-14 — Документація

- **Мета.** Оновити проєктну документацію.
- **Обсяг.** Оновити `database.md` (нові enum'и, зміни таблиць); додати секцію vehicle status flow
  в `overview.md`; оновити API-документацію.
- **Критерії приймання.** Документи відображають фактичну модель.
- **Залежності.** Фази 0–2.

#### VSF-15 — Функціонал видалення останнього статусу (Backend)

- **Мета.** Дозволити виправляти помилкові переходи (включаючи помилковий `lost`).
- **Обсяг.**
  - Ендпоінт `DELETE /vehicles/:id/status-history/last`.
  - Доступ лише для `@OrgRoles(coordinator)`.
  - Обов'язковий `expectedLastHistoryId` для захисту від rollback застарілого стану.
  - Логіка Rollback: транзакційне видалення останнього запису, оновлення `vehicles.status`
    і row lock/compare-and-swap. Дані переходу, зокрема `is_local_purchase`, зникають разом із записом.
  - Перевірка, що не видаляється статус `new`.
- **Критерії приймання.** Останній статус видаляється; статус авто оновлюється коректно; вихід
  з `lost` можливий лише через видалення запису; паралельний transition/rollback не пошкоджує історію.
- **Залежності.** VSF-6.

## 12. Родмапа

```
M1  Фундамент           VSF-1 → VSF-2 ┐
                         VSF-3         ├→ VSF-4 → VSF-5
                                       ┘
M2  Бізнес-логіка        VSF-6 → VSF-7 → VSF-8
                         ├→ VSF-15
                         └→ VSF-16

M3  Фронтенд             VSF-9 → (VSF-10, VSF-12 паралельно)
                         VSF-16 → VSF-11

M4  Стабілізація          VSF-13, VSF-14
```

**Критичний шлях:** VSF-1 → VSF-3 → VSF-4 → VSF-5 → VSF-6 → VSF-7 → VSF-8 → VSF-9 → (решта).

**Можна паралелити:**
- VSF-2 і VSF-3 — паралельно, обидва залежать від VSF-1.
- VSF-10 і VSF-12 — паралельно після VSF-9; VSF-11 додатково залежить від VSF-16.
- VSF-13 і VSF-14 — паралельно.

**Орієнтири готовності (Definition of Done епіку):**

1. Статуси — hardcoded enum, довідникова таблиця видалена.
2. Зміна статусу відбувається через структурований transition з валідацією.
3. Додаткові дані (ціна, документи, чекбокси) зберігаються в історії.
4. Алерти правильно обчислюються і відображаються.
5. Документи типізовані.
6. UI: модалка переходу, алерти на картці, деталізована історія.

## 13. Відкриті питання (вирішити до/під час імплементації)

1. **Чи потрібен перехід `arrived → ready` напряму (оминаючи `in_repair`)?** Поточна матриця
   дозволяє це — якщо авто не потребує ремонту, воно може перейти відразу у `ready`. Підтвердити.

2. **Документи при переході — завантажувати нові чи прикріплювати існуючі?** Поточний дизайн
   передбачає передачу `docId` вже існуючого документа. Альтернатива — завантаження файлу
   прямо при переході (multipart). Уточнити UX.

3. **Чи потрібен batch-перехід через кілька статусів?** Наприклад, якщо авто купується локально
   і одразу доступне — достатньо вже дозволеного `new → paid → arrived`, чи треба одним запитом
   виконувати обидва переходи?

4. **Алерти — severity `warning` vs `error`?** Визначити які алерти warning (рекомендація)
   а які error (блокер для подальших переходів).

5. **Чи блокувати перехід на наступний статус при наявності error-алертів?** Наприклад, не дозволяти
   перехід `ready → transferred` якщо не прикріплено акт. Або алерти — лише інформативні?

6. **Повторний вхід у `in_repair` — зберігати попередню `repairNote` чи перезаписувати?**
    Кожен перехід створює новий запис в історії, тож попередні нотатки збережуться. Підтвердити.
