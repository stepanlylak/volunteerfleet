# REST API

## Загальні принципи

- **Стиль:** REST + JSON. HTTP у dev, HTTPS у проді.
- **Base path:** `/api/v1`. Версіонування через URL — щоб додати `/api/v2` без поломок наявних клієнтів.
- **Контракт:** zod-схеми у `@volunteerfleet/shared` — джерело правди для типів і OpenAPI.
- **Swagger UI:** `/api/v1/docs` (генерується з zod через `nestjs-zod` + `@nestjs/swagger`).
- **Content-Type:** `application/json` скрізь, крім upload (`multipart/form-data`).

## Глобальні налаштування (`main.ts`)

```ts
app.setGlobalPrefix('api/v1');
app.use(helmet());
app.use(cookieParser());
app.enableCors({ origin: env.CORS_ORIGIN, credentials: true }); // credentials — для cookie
app.useGlobalPipes(new ZodValidationPipe());
app.useGlobalFilters(new HttpExceptionFilter()); // єдиний формат помилок
// Swagger на /api/v1/docs
```

`JwtAuthGuard` і `RolesGuard` підключені глобально через `APP_GUARD`; виключення позначаються `@Public()`,
ролі — `@Roles(...)` (див. [auth-and-security.md](auth-and-security.md)).

## Валідація через zod

Та сама схема валідує тіло запиту на сервері й форму на клієнті ([ADR-019](architecture-decisions.md#adr-019-спільна-zod-валідація-на-бекенді-й-фронтенді)):

```ts
// packages/shared/src/schemas/vehicle.ts
export const vehicleCreateSchema = z.object({
  identifier: z.string().min(1).max(64),
  brand: z.string().min(1).max(128),
  model: z.string().min(1).max(128),
  year: z.number().int().min(1900).max(2100).optional(),
  vin: z.string().max(64).optional(),
  statusId: z.string().uuid(),
  description: z.string().max(2000).optional(),
});
export type VehicleCreate = z.infer<typeof vehicleCreateSchema>;
```

```ts
// контролер
@Post()
create(@Body(new ZodValidationPipe(vehicleCreateSchema)) dto: VehicleCreate) { /* ... */ }
```

## Формат відповіді

**Один ресурс** — без обгортки `data`, дати — ISO 8601 (UTC):

```json
{
  "id": "f3e8…c9",
  "identifier": "VHC-001",
  "brand": "Toyota",
  "model": "Land Cruiser",
  "status": { "id": "…", "name": "в ремонті" },
  "createdAt": "2026-05-21T10:00:00.000Z"
}
```

**Пагінований список:**

```json
{ "items": [ /* ... */ ], "page": 1, "pageSize": 20, "total": 137, "totalPages": 7 }
```

Параметри: `?page=1&pageSize=20&sort=field:asc,field2:desc&search=...` + ресурс-специфічні фільтри.
`page` від 1 (default 1); `pageSize` default 20, max 100; `sort` — `field:asc|desc` через кому (поля
з whitelist на рівні контролера). Спільні схеми — `pageQuerySchema` / `pageResultSchema` у `shared`.

## Формат помилок

Глобальний `HttpExceptionFilter` приводить усі винятки до єдиного вигляду:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Invalid input",
  "details": [{ "path": ["year"], "message": "Expected number, received string" }],
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/api/v1/vehicles"
}
```

| `statusCode` | `code`                    | Коли                                                      |
| ------------ | ------------------------- | --------------------------------------------------------- |
| 400          | `VALIDATION_ERROR`        | zod не пройшов; `details` — issues.                       |
| 401          | `UNAUTHORIZED`            | Немає / невалідний access token.                          |
| 403          | `FORBIDDEN`               | Роль не дозволяє.                                         |
| 404          | `NOT_FOUND`               | Ресурс відсутній або soft-deleted.                        |
| 409          | `CONFLICT`                | Порушено унікальність / RESTRICT (елемент використовується). |
| 413          | `PAYLOAD_TOO_LARGE`       | Файл понад ліміт.                                         |
| 415          | `UNSUPPORTED_MEDIA_TYPE`  | MIME не у whitelist.                                      |
| 422          | `BUSINESS_RULE_VIOLATION` | Доменна перевірка (напр., немає курсу на дату).           |
| 500          | `INTERNAL_ERROR`          | Невідома помилка.                                         |

На клієнті `details: [{ path, message }]` мапиться у `form.setFields` так само, як локальні zod-issues.

## Іменування ендпоінтів

- Колекція `GET /vehicles`, один `GET /vehicles/:id`, створення `POST /vehicles`,
  часткове оновлення `PATCH /vehicles/:id`, soft delete `DELETE /vehicles/:id`,
  відновлення `POST /vehicles/:id/restore`.
- Вкладені для зручності UI: `GET /vehicles/:id/expenses`, `/documents`, `/photos`, `/status-history`.

## Перелік ендпоінтів

Колонка «Доступ» — необхідні ролі (`@Roles`) або `public` (`@Public()`).

### Auth

| Метод  | Path            | Доступ | Опис                                                          |
| ------ | --------------- | ------ | ------------------------------------------------------------- |
| `POST` | `/auth/login`   | public | Access JWT у тілі + refresh і access у httpOnly cookie.       |
| `POST` | `/auth/refresh` | public (cookie) | Ротує refresh, видає новий access.                   |
| `POST` | `/auth/logout`  | auth   | Чистить cookie.                                               |
| `GET`  | `/auth/me`      | auth   | Поточний користувач.                                         |

### Users (admin)

| Метод    | Path                        | Опис                                                        |
| -------- | --------------------------- | ---------------------------------------------------------- |
| `GET`    | `/users`                    | Список (фільтри `role`, `isActive`, `search`).             |
| `POST`   | `/users`                    | Створити користувача.                                      |
| `PATCH`  | `/users/:id`                | Змінити роль, ім'я, активність.                            |
| `POST`   | `/users/:id/reset-password` | Згенерувати новий пароль (показується одноразово в UI).    |
| `DELETE` | `/users/:id`                | Soft delete.                                                |

### Vehicles

| Метод    | Path                              | Доступ                  | Опис                                                          |
| -------- | --------------------------------- | ----------------------- | ------------------------------------------------------------ |
| `GET`    | `/vehicles`                       | admin, volunteer, guest | Список (фільтри `statusId`, `search`).                       |
| `GET`    | `/vehicles/:id`                   | admin, volunteer, guest | Картка.                                                       |
| `GET`    | `/vehicles/:id/status-history`    | admin, volunteer, guest | Історія статусів.                                            |
| `POST`   | `/vehicles`                       | admin, volunteer        | Створити.                                                     |
| `PATCH`  | `/vehicles/:id`                   | admin, volunteer        | Оновити (зміна `statusId` → запис у `vehicle_status_history`). |
| `DELETE` | `/vehicles/:id`                   | admin                   | Soft delete.                                                  |
| `POST`   | `/vehicles/:id/restore`           | admin                   | Відновити.                                                    |
| `GET`    | `/vehicles/:id/expenses`          | admin, volunteer        | Витрати по авто.                                             |
| `GET`    | `/vehicles/:id/documents`         | admin, volunteer        | Документи по авто.                                           |
| `GET`    | `/vehicles/:id/photos`            | admin, volunteer        | Фото авто.                                                   |
| `POST`   | `/vehicles/:id/photos`            | admin, volunteer        | Завантажити фото (multipart; ліміт 10 на авто).             |
| `PATCH`  | `/vehicles/:id/photos/order`      | admin, volunteer        | Змінити порядок фото.                                        |
| `GET`    | `/vehicles/:id/photos/:photoId/download` | admin, volunteer | 302 на presigned-URL фото.                                  |
| `DELETE` | `/vehicles/:id/photos/:photoId`   | admin, volunteer        | Soft delete фото.                                            |

### Expenses

| Метод    | Path                    | Доступ           | Опис                                                                          |
| -------- | ----------------------- | ---------------- | ----------------------------------------------------------------------------- |
| `GET`    | `/expenses`             | admin, volunteer | Список (фільтри `vehicleId`, `categoryId`, `fundingSourceId`, `dateFrom/To`, `currency`). |
| `POST`   | `/expenses`             | admin, volunteer | Створити (auto-rate за датою+валютою, якщо не передано).                      |
| `GET`    | `/expenses/:id`         | admin, volunteer |                                                                               |
| `PATCH`  | `/expenses/:id`         | admin, volunteer | Курс автоматично не перераховується ([ADR-010](architecture-decisions.md#adr-010-історичний-курс-не-перераховується-автоматично-при-редагуванні-витрати)). |
| `DELETE` | `/expenses/:id`         | admin            | Soft delete.                                                                  |
| `POST`   | `/expenses/:id/restore` | admin            | Відновити.                                                                    |

### Documents

| Метод    | Path                      | Доступ           | Опис                                                                          |
| -------- | ------------------------- | ---------------- | ----------------------------------------------------------------------------- |
| `GET`    | `/documents`              | admin, volunteer | Список (фільтри за `vehicleId` / `expenseId`).                               |
| `POST`   | `/documents/upload`       | admin, volunteer | `multipart/form-data`: файл + `name`, `vehicleId?`, `expenseId?`.            |
| `PATCH`  | `/documents/:id/upload`   | admin, volunteer | Замінити файл наявного документа.                                            |
| `POST`   | `/documents/link`         | admin, volunteer | JSON: `name`, `url`, `vehicleId?`, `expenseId?`.                            |
| `GET`    | `/documents/:id`          | admin, volunteer | Метадані.                                                                     |
| `GET`    | `/documents/:id/download` | admin, volunteer | 302 на presigned-URL (`upload`) або на `url` (`link`).                       |
| `PATCH`  | `/documents/:id`          | admin, volunteer | Змінити назву / перепривʼязати.                                              |
| `DELETE` | `/documents/:id`          | admin, volunteer | Soft delete.                                                                  |
| `POST`   | `/documents/:id/restore`  | admin            | Відновити.                                                                    |

### Dictionaries

`GET` — admin, volunteer; `POST`/`PATCH`/`DELETE` — admin. Три довідники:
`/dictionaries/vehicle-statuses`, `/dictionaries/expense-categories`, `/dictionaries/funding-sources`.
`DELETE` поверне `409`, якщо на елемент є посилання (RESTRICT).

### Exchange rates

| Метод | Path                                           | Доступ           | Опис                                                            |
| ----- | ---------------------------------------------- | ---------------- | --------------------------------------------------------------- |
| `GET` | `/exchange-rates?date=YYYY-MM-DD&currency=USD` | admin, volunteer | Курс із JSON-сервісу для форми витрати (див. [currency.md](currency.md)). |

### Reports

| Метод | Path                                                    | Доступ           | Опис                                                  |
| ----- | ------------------------------------------------------- | ---------------- | ----------------------------------------------------- |
| `GET` | `/reports/vehicle/:id`                                  | admin, volunteer | Зведення по авто (агрегації у UAH, історія, документи). |
| `GET` | `/reports/funding-source/:id?dateFrom=&dateTo=`         | admin, volunteer | Зведення по джерелу за період (розподіл по категоріях/авто). |

### Dashboard

| Метод | Path                | Доступ           | Опис                                                |
| ----- | ------------------- | ---------------- | --------------------------------------------------- |
| `GET` | `/dashboard/stats`  | admin, volunteer | KPI (авто всього / в роботі / передано, витрати за період) + віджети. |

### Public (анонімний доступ)

Усі — `@Public()`, не приймають токен. Якщо авто не публічне / soft-deleted / slug не знайдено → `404`
(щоб не розкривати існування запису). Деталі — [ADR-016](architecture-decisions.md#adr-016-публічний-read-only-контур-як-окремі-санітизовані-dto).

| Метод | Path                              | Опис                                                                       |
| ----- | --------------------------------- | -------------------------------------------------------------------------- |
| `GET` | `/public/vehicles/:slug`          | Санітизована картка авто: марка/модель/рік, статус, опис, фото, прогрес збору. |
| `GET` | `/public/reports/funding/:id`     | Публічний звіт по джерелу: лише агрегати (`totalUah`, `byCategory`, `byVehicle`). |
| `GET` | `/public/vehicle-photos/:id/download` | 302 на presigned-URL фото публічного авто.                            |

### Health

`GET /api/v1/health` (public) — статус застосунку й перевірка з'єднань із PostgreSQL та MinIO.

## Версіонування

Для першої версії — лише `v1`. Break-change → `/api/v2` паралельно з `/api/v1` до завершення міграції
клієнтів; non-breaking зміни (нове поле, новий optional query) — у тій самій версії.
