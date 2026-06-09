# Епік: Фінансовий флоу витрат і донатів (Financial Flow)

> **Статус:** Proposed (готовий до обговорення і декомпозиції в спринти)
> **Тип:** Епік / зміна бізнес-логіки
> **Зачіпає:** `apps/server`, `apps/client`, `packages/shared`, схему БД, reports, dashboard
> **Залежність:** Виконується **після** завершення епіку Vehicle Status Flow
> **Мова документа:** українська (наратив), англійська (ідентифікатори, таблиці, колонки, enum'и) - за правилами проєкту.

Цей документ є джерелом правди для наступного епіку після флоу статусів автомобілів. Він фіксує
цільову модель фінансів організації: витрати створюються незалежно від надходжень, донати
реєструються окремо, а користувач бачить їх як єдиний фінансовий журнал зі знаком `+` або `-`.

---

## 1. Контекст і проблема

Зараз кожна витрата вимагає `fundingSourceId`. Щоб зафіксувати реальну витрату, користувач спочатку
мусить створити "джерело фінансування", а вже потім вибрати його у формі витрати.

Цей флоу не відповідає реальній волонтерській роботі:

1. Волонтер може спочатку витратити власні або позичені кошти, наприклад купити авто за `3000 USD`.
2. Після цього організація поступово збирає донати на покриття витрати.
3. Донати можуть надходити від кількох донорів, у різні дати, різними сумами і валютами.
4. Фінансова ціль полягає не у виборі джерела для кожної витрати, а у контролі поточного балансу:
   скільки вже витрачено, скільки отримано і скільки ще потрібно зібрати.

Додаткові проблеми:

- `funding_sources` одночасно намагається бути довідником донорів, зборів, ініціатив та джерел
  конкретної витрати. Це змішує різні бізнес-поняття.
- Немає окремої сутності донату і неможливо побачити історію надходжень.
- Немає безпечної глобальної ідентичності донора, якого можуть використовувати кілька організацій.
- Іконка документів у рядку витрати переводить користувача на вкладку документів і встановлює
  фільтр замість швидкого перегляду прикріплених файлів.

## 2. Мета і нефункціональні вимоги

**Мета.** Побудувати фінансовий журнал, у якому витрати і донати є незалежними подіями, а їхня
різниця формує поточний баланс організації або конкретного автомобіля.

**Базовий сценарій:**

```text
Expense:  -3000 USD
Donation: +1000 USD, donor A
Donation: +500 USD, donor B
Donation: +1500 USD, donor C
Balance:      0 USD
```

**Нефункціональні вимоги:**

- **Відповідність реальному флоу:** витрату можна створити без донора, збору або джерела фінансування.
- **Ізоляція організацій:** організація бачить лише власні донати та власний список донорів.
- **Повторне використання донора:** одна глобальна сутність донора може бути приєднана до кількох
  організацій за точним ID без дублювання запису.
- **Приватність:** організація не може переглядати або шукати повний глобальний список донорів.
- **Історичність валют:** кожен донат, як і витрата, зберігає курс до UAH на момент події.
- **Звітність за призначенням:** донат може мати структуровану фінансову категорію, наприклад
  "Купівля авто", "Ремонт" або "Логістика".
- **Готовність до звітності:** модель та індекси дозволяють у наступному епіку агрегувати донати
  за організацією, донором, категорією та автомобілем без зміни схеми.
- **Точність журналу:** пагінація, сортування і фільтри застосовуються до об'єднаного набору до
  `LIMIT/OFFSET`, а не окремо до витрат і донатів.
- **Незмінна арифметика:** суми зберігаються додатними; знак визначається типом фінансової події.

## 3. Зафіксовані рішення (конституція епіку)

1. **Витрата більше не має джерела фінансування.**
   `expenses.funding_source_id` і поле `fundingSourceId` прибираються повністю.

2. **Донат є окремою доменною сутністю.**
   Створюється таблиця `donations` з власним CRUD, аудитом, soft delete і валютним курсом.

3. **У БД витрати і донати зберігаються в окремих таблицях.**
   Вони мають різні обов'язкові зв'язки та різні правила:
   - витрата має `category_id`;
   - донат має `donor_id`, обов'язковий `vehicle_id` та optional `category_id`;
   - витрата може мати документи;
   - донат не отримує документи у межах цього епіку.

   Єдина таблиця потрібна на рівні читання та UI, а не як поліморфна таблиця БД з великою кількістю
   nullable-полів.

4. **Єдиний журнал реалізується окремим read-only endpoint.**
   `GET /api/v1/financial-entries` повертає discriminated union `expense | donation`.
   Створення і редагування лишаються у спеціалізованих endpoint'ах `/expenses` та `/donations`.

5. **Суми в БД завжди додатні.**
   У журналі:
   - expense має `signedAmount = -amount`;
   - donation має `signedAmount = +amount`;
   - `signedAmountUah = signedAmount * rate`.

6. **Основний баланс обчислюється у UAH.**
   `balanceUahMinor = donationsUahMinor - expensesUahMinor`, де кожна подія використовує власний історичний курс.
   Додатково API повертає signed breakdown за вихідними валютами.

7. **Нуль не є DB-інваріантом.**
   Негативний баланс означає дефіцит, нуль - витрати покрито, позитивний баланс - доступний залишок.
   Система не забороняє жоден із цих станів.

8. **Донори глобальні, видимість організаційна.**
   - `donors` містить глобальну ідентичність донора з UUID.
   - `organization_donors` визначає, які донори доступні конкретній організації.
   - `donations.organization_id` визначає власника фінансового запису.

9. **Глобальний каталог донорів не доступний для browse/search.**
   Організація:
   - бачить список лише через власні `organization_donors`;
   - може приєднати донора за точним UUID;
   - може створити нового донора за ім'ям.

10. **Ім'я донора не є глобально унікальним.**
    Різні люди або організації можуть мати однакове ім'я. Безпечне повторне використання між
    організаціями відбувається лише за UUID, який донор або інша організація свідомо передає.

11. **Створення донату підтримує inline donor flow.**
    Request приймає рівно один варіант:
    - `donorId` - вибрати вже доступного або приєднати глобального донора за точним ID;
    - `newDonorName` - створити нового глобального донора і одразу приєднати його до active org.

12. **`funding_sources` видаляється як застаріла концепція.**
    Видаляються dictionary CRUD, frontend-секція, старі shared-схеми та funding-source reports.
    Нові donor reports будуються у наступному епіку за реальними donation rows.

13. **Призначення донату фіксується явно.**
    Кожен донат має обов'язковий `vehicleId` і може мати фінансову категорію, наприклад
    "Купівля авто". Це дозволяє звітувати, скільки донор передав організації на конкретне авто та,
    якщо категорію вказано, з якою метою.

14. **Призначення донату не дорівнює алокації на конкретну expense row.**
    Звіт чесно стверджує "донор задонатив X на купівлю авто" або "на авто VF-001", але не
    "цей донат оплатив витрату Y", доки немає окремої моделі allocation.

15. **Категорії стають спільними для всіх фінансових подій.**
    `expense_categories` перейменовується на `financial_categories`; expenses посилаються
    обов'язково, donations - опційно. Це дає однаковий фільтр і порівняння подій за метою.

16. **Документи витрати відкриваються у модалці.**
    Клік на іконку документів у рядку витрати більше не перемикає вкладку і не змінює фільтри.

17. **Гроші зберігаються цілими мінорними одиницями (копійки/центи).**
    Усі грошові колонки і поля — `bigint` / integer у мінорних одиницях (×100), з суфіксом `Minor`
    (DB: `amount_minor`; API: `amountMinor`, `amountUahMinor`, `balanceUahMinor` тощо), Zod
    `.int().positive()` для request. `rate` — виняток: лишається `numeric(14,6)`, бо це множник, а
    не сума. Конвертація в UAH: `amountUahMinor = round(amountMinor * rate)` (per-row, до цілих
    копійок). JS-арифметика сум безпечна (цілі < 2^53); агрегація — у SQL. UI конвертує у major-
    одиниці лише на краях (введення/відображення).

## 4. Фінансова модель і баланс

### 4.1. Нормалізація сум

Суми зберігаються й передаються цілими мінорними одиницями (`amountMinor`, ×100). Для кожної
активної події:

```text
amountUahMinor = round(amountMinor * rate)        # ціле, у копійках (per-row)
signedAmountUahMinor =
  donation -> +amountUahMinor
  expense  -> -amountUahMinor
```

Агрегати (рахуються в SQL, повертаються цілими копійками):

```text
expensesUahMinor = sum(round(expense.amount_minor * expense.rate))
donationsUahMinor = sum(round(donation.amount_minor * donation.rate))
balanceUahMinor = donationsUahMinor - expensesUahMinor
```

Soft-deleted записи не враховуються. `round()` застосовується per-row після множення на `rate`
(курс дробовий), щоб сума збігалася з відображеними по рядках UAH-значеннями.

### 4.2. Breakdown за валютою

Для кожної валюти API повертає:

```json
{
  "currency": "USD",
  "expensesMinor": 300000,
  "donationsMinor": 150000,
  "balanceMinor": -150000
}
```

Це не замінює `balanceUahMinor`. Значення різних валют не складаються між собою без конвертації.

### 4.3. Змішані валюти

Якщо витрата була `3000 USD`, а донати надійшли у USD, EUR та UAH, цільовим показником є
`balanceUahMinor`, обчислений за збереженим курсом кожної події. Через різні дати і курси нативний
USD-еквівалент може не дорівнювати нулю навіть тоді, коли UAH-баланс закритий.

UI показує:

- `balanceUahMinor < 0`: **Потрібно зібрати**;
- `balanceUahMinor = 0`: **Баланс закрито**;
- `balanceUahMinor > 0`: **Доступний залишок**.

Порівняння з нулем точне — значення вже цілі копійки (округлення per-row застосоване при обчисленні).

### 4.4. Область балансу

`GET /financial-entries` повертає summary для поточного набору фільтрів:

- без фільтрів - баланс active org;
- з `vehicleId` - баланс подій, прямо прив'язаних до авто;
- з `categoryId` - витрати й донати однієї фінансової категорії;
- з періодом - рух коштів за період;
- з `type` - лише сума витрат або лише сума донатів.

Оскільки і витрата, і донат **обовʼязково** мають `vehicleId`, org-level баланс точно дорівнює сумі
балансів усіх автомобілів організації — фінансових подій без авто не існує. Розподіл однієї суми
(донату чи витрати) між кількома авто поза обсягом цього епіку: волонтер створює окремі rows із
відповідними сумами (наприклад, 100 000 грн від донора → 30 000 на авто 1 і 70 000 на авто 2).

## 5. Модель донорів

### 5.1. `donors`

Глобальна таблиця без `organization_id`.

| Колонка           | Тип          | Обмеження / опис                                      |
| ----------------- | ------------ | ----------------------------------------------------- |
| `id`              | uuid         | PK, глобальний donor ID                               |
| `name`            | varchar(255) | NOT NULL, не unique                                   |
| `normalized_name` | varchar(255) | NOT NULL, для локальної перевірки можливого дубліката |
| `created_by`      | uuid         | FK -> `users.id`, NOT NULL                            |
| `created_at`      | timestamptz  | NOT NULL                                              |
| `updated_at`      | timestamptz  | NOT NULL                                              |

`normalized_name` формується сервером: trim, collapse whitespace, Unicode lowercase. Це допоміжне
поле, а не глобальний unique key. На нього додається non-unique index для перевірки можливих
дублікатів.

У межах епіку немає загального endpoint'а для списку всіх `donors`.

При створенні сервер перевіряє донорів, уже пов'язаних з active org, за `normalized_name`. Якщо
знайдено збіг, повертається `409 DONOR_NAME_ALREADY_EXISTS` з мінімальним списком локальних matches.
Користувач може вибрати наявного донора або явно підтвердити створення тезки через
`allowDuplicateName = true`. Донори інших організацій у цю перевірку не потрапляють.

### 5.2. `organization_donors`

Junction-таблиця видимості.

| Колонка           | Тип         | Обмеження / опис                   |
| ----------------- | ----------- | ---------------------------------- |
| `organization_id` | uuid        | FK -> `organizations.id`, NOT NULL |
| `donor_id`        | uuid        | FK -> `donors.id`, NOT NULL        |
| `is_active`       | boolean     | NOT NULL, default `true`           |
| `added_by`        | uuid        | FK -> `users.id`, NOT NULL         |
| `updated_by`      | uuid        | FK -> `users.id`, NOT NULL         |
| `created_at`      | timestamptz | NOT NULL                           |
| `updated_at`      | timestamptz | NOT NULL                           |

Обмеження та індекси:

- composite PK: `(organization_id, donor_id)`;
- index: `(organization_id, is_active)`;
- index: `(donor_id)`.

Деактивація зв'язку приховує донора з picker'а, але не ламає історичні донати. Повторне додавання
того самого ID встановлює `is_active = true`.

### 5.3. Приватність і повторне використання

- `GET /donors` повертає тільки донорів active org.
- `GET /donors/resolve/:id` працює лише за повним валідним UUID і повертає мінімум:
  `id`, `name`, `alreadyLinked`.
- Endpoint не повертає список організацій, донати, контактні дані або результати пошуку за частиною ID.
- `POST /donors/link` приєднує знайдений ID до active org.
- UUID можна скопіювати зі сторінки донора і передати іншій організації поза системою.

Глобальна дедуплікація лише за ім'ям свідомо не виконується: вона створила б помилкові злиття
однофамільців і розкривала б чужий каталог через пошук.

### 5.4. Редагування і видалення

У межах епіку:

- ім'я глобального донора після створення не редагується через org UI;
- "видалити зі списку" означає `organization_donors.is_active = false`;
- глобальний donor row не видаляється;
- історичні donation response завжди містять поточне `donors.name`.

Глобальне злиття дублікатів, перейменування і контактний профіль донора поза обсягом. Виправлення
помилкових дублікатів до появи повноцінного merge-флоу виконує superadmin вручну.

## 6. Модель даних

### 6.1. Нова таблиця `donations`

| Колонка           | Тип             | Обмеження / опис                             |
| ----------------- | --------------- | -------------------------------------------- |
| `id`              | uuid            | PK                                           |
| `organization_id` | uuid            | FK -> `organizations.id`, RESTRICT, NOT NULL |
| `donor_id`        | uuid            | FK -> `donors.id`, RESTRICT, NOT NULL        |
| `category_id`     | uuid            | FK -> `financial_categories.id`, nullable    |
| `vehicle_id`      | uuid            | FK -> `vehicles.id`, RESTRICT, NOT NULL      |
| `donation_date`   | date            | NOT NULL                                     |
| `amount_minor`    | bigint          | NOT NULL, CHECK `> 0`; сума у мінорних одиницях (×100) |
| `currency`        | `currency_code` | NOT NULL                                     |
| `rate`            | numeric(14,6)   | NOT NULL, CHECK `> 0`; для UAH = `1`         |
| `rate_source`     | `rate_source`   | NOT NULL, `default \| manual`                |
| `description`     | text            | nullable                                     |
| `created_by`      | uuid            | FK -> `users.id`, RESTRICT, NOT NULL         |
| `updated_by`      | uuid            | FK -> `users.id`, RESTRICT, NOT NULL         |
| `created_at`      | timestamptz     | NOT NULL                                     |
| `updated_at`      | timestamptz     | NOT NULL                                     |
| `deleted_at`      | timestamptz     | nullable                                     |
| `deleted_by`      | uuid            | FK -> `users.id`, RESTRICT, nullable         |

DB-інваріант: composite FK
`(organization_id, donor_id) -> organization_donors(organization_id, donor_id)` гарантує, що донат
не може посилатися на донора, який не приєднаний до цієї організації. Окремі FK на `organizations`
і `donors` зберігаються для явної цілісності та relations.

Індекси:

- `(organization_id)`;
- `(organization_id, donation_date)`;
- `(organization_id, donor_id, vehicle_id)`;
- `(donor_id, organization_id, vehicle_id)`;
- `(organization_id, category_id)`;
- `(organization_id, vehicle_id)`;
- partial index для активних записів за потреби query plan.

### 6.2. Зміни `expenses`

- видалити `funding_source_id`;
- видалити FK та `expenses_funding_source_id_idx`;
- `ExpenseCreate`, `ExpenseUpdate`, `ExpenseResponse`, list filters більше не містять
  `fundingSourceId` / `fundingSource`;
- `category_id` тепер посилається на перейменовану таблицю `financial_categories`;
- `vehicle_id` стає обовʼязковим (`NOT NULL`): кожна витрата, як і донат, привʼязана до авто;
- `amount numeric(14,2)` → `amount_minor bigint` (мінорні одиниці); `rate` лишається `numeric(14,6)`;
- решта audit і soft-delete моделі не змінюється.

### 6.3. `financial_categories`

Наявна таблиця `expense_categories` перейменовується на `financial_categories` без зміни UUID
наявних категорій. Структура залишається: `id`, `name`, `sort_order`, timestamps.

- `expenses.category_id -> financial_categories.id`;
- `donations.category_id -> financial_categories.id` (nullable);
- API `/dictionaries/expense-categories` замінюється на `/dictionaries/financial-categories`;
- frontend label "Категорії витрат" замінюється на "Фінансові категорії";
- seed містить щонайменше "Купівля авто", "Ремонт", "Логістика", "Загальні потреби".

### 6.4. Видалення `funding_sources`

Видаляються:

- таблиця `funding_sources`;
- enum `funding_source_type`;
- relations `fundingSourcesRelations` та `expenses.fundingSource`;
- `/dictionaries/funding-sources`;
- shared-схеми `FundingSource*`;
- frontend dictionary tab і modal fields;
- seed-дані funding sources;
- старі funding-source reports та public routes.

### 6.5. `documents`

Схема `documents` у цьому епіку не змінюється. Документ і далі може бути прив'язаний до витрати через
`expense_id`. Прив'язка документа до донату не додається.

## 7. API

### 7.1. Donations CRUD

| Метод    | Path                     | Доступ                         | Опис                      |
| -------- | ------------------------ | ------------------------------ | ------------------------- |
| `GET`    | `/donations`             | coordinator, volunteer, viewer | Список донатів active org |
| `POST`   | `/donations`             | coordinator, volunteer         | Створити донат            |
| `GET`    | `/donations/:id`         | coordinator, volunteer, viewer | Деталі донату             |
| `PATCH`  | `/donations/:id`         | coordinator, volunteer         | Редагувати донат          |
| `DELETE` | `/donations/:id`         | coordinator                    | Soft delete               |
| `POST`   | `/donations/:id/restore` | coordinator                    | Відновити                 |

`DonationCreate` є strict union за способом вибору донора:

```json
{
  "donationDate": "2026-06-09",
  "amountMinor": 100000,
  "currency": "USD",
  "rate": 41.25,
  "categoryId": "purchase-vehicle-category-uuid",
  "vehicleId": "vehicle-uuid",
  "donorId": "existing-global-donor-uuid",
  "description": "На придбання авто"
}
```

або:

```json
{
  "donationDate": "2026-06-09",
  "amountMinor": 100000,
  "currency": "USD",
  "rate": 41.25,
  "categoryId": "purchase-vehicle-category-uuid",
  "vehicleId": "vehicle-uuid",
  "newDonorName": "Ім'я або назва донора",
  "description": "На придбання авто"
}
```

Правила:

1. Передається рівно одне з `donorId` або `newDonorName`.
2. `organizationId` не приймається з body.
3. Якщо `donorId` існує, але ще не приєднаний до active org, зв'язок створюється у тій самій
   транзакції, що і донат.
4. Якщо `categoryId` передано, він має посилатися на активну фінансову категорію.
5. `vehicleId` обов'язковий; авто має належати active org, інакше `404`.
6. Для UAH сервер примусово зберігає `rate = 1`, `rateSource = default`.
7. Для іншої валюти без `rate` сервер використовує `ExchangeRatesService`.
8. `PATCH` не перераховує історичний курс автоматично, за правилами ADR-010.

`GET /donations` підтримує фільтри `donorId`, `vehicleId`, `categoryId`, `dateFrom`, `dateTo`,
`currency`. `organizationId` завжди береться з active org. Комбінація `organizationId + donorId`
дає всі донати донора цьому фонду, а групування цих rows за `vehicleId` у майбутньому звітному
епіку дає статистику по всіх автомобілях.

### 7.2. Donors

| Метод    | Path                  | Доступ                         | Опис                                      |
| -------- | --------------------- | ------------------------------ | ----------------------------------------- |
| `GET`    | `/donors`             | coordinator, volunteer, viewer | Донори active org                         |
| `POST`   | `/donors`             | coordinator, volunteer         | Створити нового і приєднати до active org |
| `GET`    | `/donors/resolve/:id` | coordinator, volunteer         | Точний lookup глобального UUID            |
| `POST`   | `/donors/link`        | coordinator, volunteer         | Приєднати за UUID                         |
| `DELETE` | `/donors/:id/link`    | coordinator                    | Деактивувати зв'язок з active org         |

`POST /donors` не приймає `organizationId`. Сервер створює `donors` і `organization_donors`
транзакційно.

### 7.3. Unified financial journal

**`GET /api/v1/financial-entries`**

Query:

| Поле         | Тип                   | Опис                                 |
| ------------ | --------------------- | ------------------------------------ |
| `page`       | integer               | Пагінація                            |
| `pageSize`   | integer               | Пагінація                            |
| `sort`       | string                | `entryDate`, `amount`, `createdAt`   |
| `type`       | `expense \| donation` | Не передано - обидва типи            |
| `vehicleId`  | uuid                  | Події конкретного авто               |
| `categoryId` | uuid                  | Спільна категорія expenses/donations |
| `donorId`    | uuid                  | Застосовується до donations          |
| `dateFrom`   | date                  | Початок періоду                      |
| `dateTo`     | date                  | Кінець періоду                       |
| `currency`   | `UAH \| USD \| EUR`   | Вихідна валюта                       |

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "type": "expense",
      "entryDate": "2026-06-01",
      "amountMinor": 300000,
      "signedAmountMinor": -300000,
      "currency": "USD",
      "rate": 41.25,
      "amountUahMinor": 12375000,
      "signedAmountUahMinor": -12375000,
      "vehicle": {
        "id": "uuid",
        "identifier": "VF-001",
        "brand": "Ford",
        "model": "Ranger"
      },
      "category": {
        "id": "uuid",
        "name": "Купівля авто"
      },
      "donor": null,
      "description": "Купівля авто",
      "documentCount": 1
    },
    {
      "id": "uuid",
      "type": "donation",
      "entryDate": "2026-06-05",
      "amountMinor": 100000,
      "signedAmountMinor": 100000,
      "currency": "USD",
      "rate": 41.25,
      "amountUahMinor": 4125000,
      "signedAmountUahMinor": 4125000,
      "vehicle": {
        "id": "uuid",
        "identifier": "VF-001",
        "brand": "Ford",
        "model": "Ranger"
      },
      "category": {
        "id": "uuid",
        "name": "Купівля авто"
      },
      "donor": {
        "id": "uuid",
        "name": "Donor name"
      },
      "description": null
    }
  ],
  "summary": {
    "expensesUahMinor": 12375000,
    "donationsUahMinor": 4125000,
    "balanceUahMinor": -8250000,
    "byCurrency": [
      {
        "currency": "USD",
        "expensesMinor": 300000,
        "donationsMinor": 100000,
        "balanceMinor": -200000
      }
    ]
  },
  "page": 1,
  "pageSize": 20,
  "total": 2,
  "totalPages": 1
}
```

`FinancialEntry` реалізується у shared як discriminated union за `type`. Поля `category` і `donor`
мають точні типи у відповідній гілці, а не загальний набір optional-полів. `documentCount` існує
тільки у гілці `expense` і рахує лише активні документи витрати (`deleted_at IS NULL`).

SQL-реалізація має виконувати `UNION ALL` нормалізованих active expenses і donations, після чого
застосовувати спільні sort/pagination. Summary рахується окремим aggregate query з тими самими
фільтрами.

Семантика фільтрів:

- `categoryId` застосовується до обох branches і дозволяє порівняти витрати та донати за метою;
- `donorId` виключає expense branch і повертає лише відповідні donations;
- `categoryId + donorId` повертає донати цього донора у вибраній категорії;
- сортування за `amount` виконується за UAH-нормалізованим значенням (`amountUahMinor`), а не за
  сирою сумою у вихідній валюті; символ валюти лишається лише для відображення;
- sort завжди має стабільний tie-breaker `createdAt DESC, id DESC`.

### 7.4. Expenses

Наявний CRUD `/expenses` зберігається, але:

- create/update не приймає `fundingSourceId`;
- `vehicleId` стає обовʼязковим; авто має належати active org, інакше `404`;
- response не повертає `fundingSource`;
- list не фільтрує за funding source;
- створення витрати не залежить від наявності донорів або донатів.

### 7.5. Reports

Старі funding-source endpoint'и:

- `/reports/funding-source/:id`;
- `/public/:orgId/reports/funding/:fundingSourceId`

видаляються разом із `funding_sources`.

Нові окремі donor-facing і public reports у цьому епіку не реалізуються. Для наступного епіку
підготовлено достатню модель:

- кожен donation має `organization_id`, `donor_id`, `vehicle_id`, `category_id`, суму, валюту і курс;
- `GET /donations` уміє фільтрувати за donor/vehicle/category/date;
- індекс `(organization_id, donor_id, vehicle_id)` підтримує зріз "донор у фонді за автомобілями";
- індекс `(donor_id, organization_id, vehicle_id)` підтримує майбутній cross-org звіт одного донора;
- unified journal уже повертає org-scoped фінансові події.

Майбутній звіт зможе без зміни схеми показати, що донор задонатив на п'ять різних автомобілів,
які саме суми отримав кожен автомобіль і до якої фінансової категорії належав кожен донат.

## 8. Frontend

### 8.1. Сторінка фінансів

Нова основна сторінка: `/finances`.

Наявний пункт меню "Витрати" перейменовується на "Фінанси". `/expenses` лишається redirect на
`/finances` на перехідний період.

Header сторінки:

- KPI `Витрати`;
- KPI `Донати`;
- KPI `Баланс` з підписом стану;
- кнопки `Додати витрату` і `Додати донат`.

Таблиця:

| Колонка   | Expense               | Donation              |
| --------- | --------------------- | --------------------- |
| Дата      | `expenseDate`         | `donationDate`        |
| Тип       | `Витрата`             | `Донат`               |
| Сума      | червоне `-3 000 USD`  | зелене `+1 000 USD`   |
| UAH       | signed UAH equivalent | signed UAH equivalent |
| Авто      | required vehicle      | required vehicle      |
| Деталі    | category              | donor                 |
| Опис      | description           | description           |
| Документи | count + modal         | не показується        |
| Дії       | edit/delete за роллю  | edit/delete за роллю  |

Фільтри:

- усі / витрати / донати;
- авто;
- категорія;
- донор;
- валюта;
- період.

### 8.2. Форма витрати

- поле "Джерело фінансування" прибирається;
- автомобіль стає обовʼязковим полем форми;
- решта полів і attachment flow зберігаються;
- витрата зберігається без перевірки донорів або балансу.

### 8.3. Форма донату

Поля:

- дата;
- сума;
- валюта;
- курс;
- optional фінансова категорія/призначення;
- donor picker;
- автомобіль;
- optional опис.

Donor picker:

1. Пошук серед донорів active org.
2. Дія `Створити нового донора` з inline-полем імені.
3. Дія `Додати за ID` з exact UUID lookup і confirmation.
4. Після створення або link донор одразу вибирається у формі.

Форма використовує той самий reusable компонент amount/currency/rate, що і витрата та paid-transition
з Vehicle Status Flow.

### 8.4. Сторінка донорів

Route: `/donors`.

Містить:

- список донорів active org;
- ім'я;
- UUID з copy action;
- кнопки `Додати донора`, `Додати за ID`, `Приховати зі списку`.

Сторінка не показує, з якими іншими організаціями пов'язаний донор.

### 8.5. Картка автомобіля

Вкладка "Витрати" перейменовується на "Фінанси" і використовує unified journal з `vehicleId`.

Відображає:

- витрати авто;
- донати, прямо прив'язані до авто;
- баланс авто;
- кнопки додавання витрати і донату з preselected vehicle.

Кожен донат уже має `vehicleId`, тому вкладка показує повний набір донатів, призначених цьому авто.

## 9. Модалка деталей документа

### 9.1. Поведінка

Клік на paperclip/count у рядку витрати:

- не змінює active tab;
- не встановлює document filters;
- відкриває modal зі списком документів цієї витрати.

Якщо документ один, modal одразу показує його деталі. Якщо документів кілька, користувач перемикається
між ними всередині modal.

### 9.2. Вміст

- назва;
- `kind` (`upload` або `link`);
- MIME type;
- розмір;
- дата додавання;
- ким додано;
- пов'язана витрата;
- preview;
- `Завантажити` для upload;
- `Відкрити посилання` для link.

### 9.3. Preview

Підтримується:

- `image/*` - Ant Design `Image`;
- `application/pdf` - sandboxed `iframe` або `object`;
- інші MIME - placeholder з типом файлу і кнопкою завантаження.

Зовнішні link-документи не вбудовуються в iframe через ризики безпеки і `X-Frame-Options`. Для них
показується URL та явна кнопка відкриття у новій вкладці.

### 9.4. Download contract

Наявний endpoint розширюється:

```text
GET /documents/:id/download?disposition=inline|attachment
```

- default `inline` для наявних preview;
- modal preview використовує `inline`;
- кнопка завантаження використовує `attachment`;
- orgScope і ролі не змінюються.

Компонент `DocumentDetailsModal` є generic і може повторно використовуватися у вкладці документів.

## 10. Ролі та інваріанти

| Дія                           | coordinator | volunteer | viewer |
| ----------------------------- | :---------: | :-------: | :----: |
| Перегляд журналу/балансу      |      +      |     +     |   +    |
| Створення/редагування витрати |      +      |     +     |   -    |
| Створення/редагування донату  |      +      |     +     |   -    |
| Створення/link донора         |      +      |     +     |   -    |
| Soft delete/restore           |      +      |     -     |   -    |
| Приховати донора зі списку    |      +      |     -     |   -    |

Обов'язкові інваріанти:

1. `organization_id` завжди береться з `activeOrgId`, а не з request body.
2. By-id доступ до запису іншої організації повертає `404`.
3. Donation завжди має `vehicleId`, який посилається на авто active org.
4. Якщо donation має `categoryId`, категорія валідна й використовується як заявлене призначення.
5. Donation з `donorId` автоматично створює або активує `organization_donors` для active org.
6. Donor list ніколи не читає `donors` без join/filter через `organization_donors`.
7. Financial journal завжди фільтрує обидві гілки union за active org.
8. Soft-deleted expenses/donations не входять у summary.
9. Viewer не отримує mutation controls у UI, навіть якщо endpoint додатково захищений guard'ом.
10. API не приймає від клієнта signed amount. Знак визначається сервером з `type`.

## 11. Взаємодія з Vehicle Status Flow

1. Епік виконується після Vehicle Status Flow і працює з фінальною enum-моделлю статусів.
2. Ціна купівлі більше не зберігається мертвими колонками у статусному переході. Поля
   `purchase_price/currency/rate/rate_source` прибираються з `vehicle_status_history`; на переході
   `-> paid` лишається лише `is_local_purchase` (+ техпаспорт), бо це митна логіка й умова
   `paid -> arrived`.
3. Купівля авто фіксується **звичайною витратою** категорії "Купівля авто" у фінансовому журналі —
   так вона нарешті потрапляє в баланс. Форма переходу `-> paid` може запропонувати створити цю
   витрату вже заповненою (vehicle, дата, сума/валюта/курс), але це звичайна expense row: відкат
   статусу її не чіпає, редагування і видалення незалежні. Автоматичного звʼязку чи каскаду немає.
4. Shared amount/currency/rate component, запланований у VSF, повторно використовується у
   `ExpenseFormModal` і `DonationFormModal`.
5. `document_type` зі статусного епіку не змінює поведінку `DocumentDetailsModal`: preview визначається
   за MIME, а бізнес-тип документа показується додатковим metadata field.
6. Міграції цього епіку створюються поверх фінальної схеми статусного епіку; вони ж прибирають
   redundant price-колонки з `vehicle_status_history`. Живих даних на проді немає, тож міграції
   доводяться до фінального стану при імплементації, а БД перестворюється — backfill не потрібен.

## 12. Міграція і сумісність

Перед реалізацією перевірити, чи існують середовища з реальними даними.

### Якщо живих даних немає

- видалити `expenses.funding_source_id` одразу;
- зробити `expenses.vehicle_id` `NOT NULL`;
- перевести грошові колонки у `bigint` мінорні одиниці: `expenses.amount → amount_minor`,
  `vehicles.public_collected_amount_uah` / `public_goal_amount_uah`, `donations.amount_minor`
  (`rate` лишається numeric);
- видалити `funding_sources` та enum;
- перейменувати `expense_categories` на `financial_categories`, зберігши UUID;
- створити `donors`, `organization_donors`, `donations`;
- оновити seed і fixtures;
- не переносити funding source rows у donors автоматично, бо їхня семантика неоднозначна.

### Якщо живі дані вже є

Потрібен окремий migration plan до початку реалізації:

1. Зробити `funding_source_id` nullable.
2. Визначити, які funding sources справді є донорами.
3. Створити donor rows і organization links.
4. Перейменувати `expense_categories` на `financial_categories` без втрати id.
5. Не конвертувати expense у donation.
6. Заповнити `vehicle_id` для витрат без авто (backfill або ручне рознесення) перед тим, як ставити `NOT NULL`.
7. Сконвертувати грошові суми у мінорні одиниці (`round(amount * 100)`) при зміні типу колонок на `bigint`.
8. Після перевірки даних видалити FK/column/table і застосувати `NOT NULL` на `expenses.vehicle_id`.

Автоматичне припущення `funding_source = donor` заборонене.

## 13. Поза обсягом

- Allocation донату на одну або кілька конкретних витрат.
- Розподіл одного donation row між кількома автомобілями.
- Окремі donor-facing, cross-org і публічні звіти; для них буде наступний епік.
- Платіжні інтеграції, імпорт банківських виписок, webhooks.
- Регулярні/recurring донати.
- Контактні дані, CRM-поля, consent і комунікації з донорами.
- Глобальний пошук донорів за ім'ям.
- Merge глобальних donor duplicates.
- Редагування глобального canonical donor name.
- Документи/квитанції, прикріплені до donation.
- Бюджети, рахунки, каси, внутрішні перекази між валютами.
- Автоматичне (звʼязане каскадом) створення чи видалення expense при статусному переході: купівля
  фіксується звичайною витратою, форма переходу лише пропонує її prefilled.

## 14. Тікети

Кожен тікет приблизно дорівнює одному PR. Формат: **Мета / Обсяг / Критерії приймання / Залежності**.

### Фаза 0 - Контракти і схема

#### FIN-1 - Shared financial contracts

- **Мета.** Зафіксувати типи донату, донора, журналу і summary.
- **Обсяг.** `DonationCreate/Update/Response`, `DonorResponse`, `FinancialEntry` strict discriminated
  union, filters, summary schemas; спільний `FinancialCategory`; прибрати funding source з expense
  contracts; зробити `vehicleId` обовʼязковим у expense contracts.
- **Критерії приймання.** XOR `donorId/newDonorName` валідується; signed fields є тільки response;
  `pnpm -w typecheck` зелений.
- **Залежності.** Vehicle Status Flow завершено.

#### FIN-2 - Схема `donors` та `organization_donors`

- **Мета.** Глобальна donor identity з org-scoped visibility.
- **Обсяг.** Drizzle tables, relations, indexes, normalization helper.
- **Критерії приймання.** Один donor UUID можна зв'язати з кількома org; список можна отримати лише
  через org junction.
- **Залежності.** FIN-1.

#### FIN-3 - Схема `donations`

- **Мета.** Додати позитивні фінансові події.
- **Обсяг.** Drizzle table, mandatory vehicle, optional category, currency/rate checks, audit,
  soft delete, org/vehicle/donor/category relations.
- **Критерії приймання.** Схема відповідає розд. 6; vehicle обов'язковий; amount/rate не можуть
  бути `<= 0`.
- **Залежності.** FIN-2.

#### FIN-4 - Фінансові категорії, видалення `funding_sources` і міграція

- **Мета.** Прибрати обов'язкове джерело фінансування.
- **Обсяг.** Rename `expense_categories -> financial_categories`; drop expense funding FK/column/index;
  `expenses.vehicle_id -> NOT NULL`; drop `funding_sources` table/enum/contracts/dictionary/seed; drop
  redundant `vehicle_status_history` price-колонки (`purchase_price/currency/rate/rate_source`);
  створення нових таблиць; стратегія з розд. 12.
- **Критерії приймання.** Expense створюється без funding source і з обовʼязковим `vehicleId`;
  runtime-згадок `fundingSource` немає; price-колонок у `vehicle_status_history` немає; міграція
  проходить на цільовому середовищі.
- **Залежності.** FIN-2, FIN-3.

### Фаза 1 - Backend

#### FIN-5 - Donors API

- **Мета.** Керувати org donor list без розкриття глобального каталогу.
- **Обсяг.** List, create, exact resolve by UUID, link, deactivate; org roles; transactions.
- **Критерії приймання.** Org A не browse'ить donors org B; exact UUID можна приєднати; response не
  розкриває чужі org або донати.
- **Залежності.** FIN-4.

#### FIN-6 - Donations CRUD

- **Мета.** Створювати і редагувати донати.
- **Обсяг.** CRUD, mandatory vehicle, optional financial category, rate resolution, inline donor
  create/link, vehicle same-org validation, soft delete; filters by donor/vehicle/category/date.
- **Критерії приймання.** Обидва donor flows працюють транзакційно; org isolation і ролі покриті тестами.
- **Залежності.** FIN-5.

#### FIN-7 - Expense flow без funding source

- **Мета.** Спрощена форма і API витрати.
- **Обсяг.** Оновити expense service/controller/contracts/tests/reports mappings.
- **Критерії приймання.** Create/update/list працюють без funding source і з обовʼязковим `vehicleId`;
  старий request field відхиляється strict schema.
- **Залежності.** FIN-4.

#### FIN-8 - Unified financial journal і balance

- **Мета.** Один endpoint для таблиці і KPI.
- **Обсяг.** SQL `UNION ALL`, filters, stable sorting, pagination, summary, currency breakdown,
  shared category filter, document count для expense rows.
- **Критерії приймання.** Пагінація відбувається після union; summary відповідає тим самим фільтрам;
  signed arithmetic покрита unit/integration tests.
- **Залежності.** FIN-6, FIN-7.

#### FIN-9 - Cleanup старих reports і reporting-ready queries

- **Мета.** Прибрати застарілі funding reports і залишити стабільну основу для наступного епіку.
- **Обсяг.** Видалити funding-source report/public routes; перевірити list filters та індекси
  `(organization_id, donor_id, vehicle_id)` / `(donor_id, organization_id, vehicle_id)`; оновити
  dashboard лише базовими finance KPI.
- **Критерії приймання.** Старих funding routes немає; donation rows можна вибрати за org + donor і
  згрупувати за vehicle без зміни схеми або повного table scan.
- **Залежності.** FIN-8.

### Фаза 2 - Frontend

#### FIN-10 - Reusable money fields

- **Мета.** Не дублювати amount/currency/rate logic.
- **Обсяг.** Винести компонент із VSF/expense form, використати у expense і donation forms.
- **Критерії приймання.** Auto-rate, manual rate і UAH=1 поводяться однаково в обох формах.
- **Залежності.** FIN-6, FIN-7 і відповідний VSF ticket.

#### FIN-11 - Donor picker і сторінка донорів

- **Мета.** Вибір, inline create і link за ID.
- **Обсяг.** `/donors`, list, UUID copy, create/link/deactivate; reusable donor picker.
- **Критерії приймання.** Користувач завершує обидва flows без переходу в admin dictionaries.
- **Залежності.** FIN-5.

#### FIN-12 - Donation form

- **Мета.** Додавати надходження з finance page і vehicle card.
- **Обсяг.** `DonationFormModal`, optional financial category, donor picker, required vehicle,
  vehicle preselection, edit flow.
- **Критерії приймання.** Донат з existing/new/exact-ID donor створюється end-to-end.
- **Залежності.** FIN-6, FIN-10, FIN-11.

#### FIN-13 - Finance page

- **Мета.** Замінити expenses-only page єдиним журналом.
- **Обсяг.** `/finances`, KPI, filters, signed rows, actions, `/expenses` redirect.
- **Критерії приймання.** Можна фільтрувати all/expense/donation; balance оновлюється з фільтрами;
  role-based controls коректні.
- **Залежності.** FIN-8, FIN-12.

#### FIN-14 - Finance tab у картці авто

- **Мета.** Показати витрати, донати і баланс авто в одному місці.
- **Обсяг.** Перейменувати tab, використати journal з `vehicleId`, додати обидві create actions;
  на переході `→ paid` запропонувати створення prefilled-витрати "Купівля авто".
- **Критерії приймання.** Відображаються лише прямо пов'язані з авто записи; створений з картки
  донат автоматично отримує це `vehicleId`; з paid-переходу можна одним кроком створити витрату
  купівлі, і вона зʼявляється у балансі авто.
- **Залежності.** FIN-13.

#### FIN-15 - Document details modal

- **Мета.** Переглядати файли витрати без переходу на вкладку документів.
- **Обсяг.** Generic `DocumentDetailsModal`, image/PDF preview, metadata, inline/attachment URLs,
  multi-document navigation; прибрати старий tab/filter side effect.
- **Критерії приймання.** Paperclip відкриває modal; image/PDF preview працює; unsupported type можна
  завантажити; active tab і filters не змінюються.
- **Залежності.** FIN-7. Може виконуватися паралельно з donation backend і FIN-13.

### Фаза 3 - Завершення

#### FIN-16 - Наскрізні тести і документація

- **Мета.** Перевірити головний бізнес-сценарій і синхронізувати технічні docs.
- **Обсяг.** E2E/integration scenario `expense -3000 -> three donations -> zero`; обов'язкові
  vehicle/category; вибірка donations за org + donor і групування за п'ятьма авто; org isolation;
  mixed currencies; soft delete; docs preview; оновити `database.md`, `api.md`, `currency.md`,
  `files.md`, `frontend.md`, `architecture-decisions.md`.
- **Критерії приймання.** Основний сценарій зелений; жоден актуальний doc не описує funding source
  як обов'язкове поле expense.
- **Залежності.** FIN-9, FIN-14, FIN-15.

## 15. Definition of Done

Епік завершено, коли:

1. Витрату можна створити без попереднього створення будь-якого джерела.
2. Донат можна створити з наявним, новим або приєднаним за UUID донором та обов'язковим авто.
3. Організація бачить лише свій donor list і свої фінансові записи.
4. `/finances` показує витрати та донати в одному хронологічному журналі.
5. Баланс коректно рахується у UAH та за вихідними валютами.
6. На картці авто є finance tab з прямо пов'язаними записами.
7. Funding source dictionary і старі funding reports видалені.
8. Документи витрати відкриваються у details modal без зміни вкладки.
9. Основний сценарій `-3000 + 1000 + 500 + 1500 = 0` покритий тестом.
10. Донати можна вибрати за org + donor і згрупувати за автомобілями для наступного епіку звітності.
11. Купівля авто з paid-переходу фіксується звичайною витратою і потрапляє в баланс; price-колонок у
    `vehicle_status_history` немає.
12. Технічна документація оновлена разом із реалізацією.
