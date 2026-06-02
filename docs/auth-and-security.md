# Автентифікація, авторизація, безпека

## Ролі

| Роль        | Права                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------- |
| `admin`     | Повний доступ; керування користувачами й довідниками; soft delete / restore; reset пароля.  |
| `volunteer` | Створення/редагування авто, витрат, документів, фото; перегляд звітів.                       |
| `guest`     | Read-only доступ до реєстру авто в back-office (список, картка, історія статусів).           |

Окремо від ролей існує **анонімний публічний контур** (`/public/...`, [ADR-016](architecture-decisions.md#adr-016-публічний-read-only-контур-як-окремі-санітизовані-dto)):
сторінки авто, які адмін явно позначив публічними, відкриваються без логіну й повертають санітизовані
дані без приватних полів.

## Автентифікація

### Логін

`POST /api/v1/auth/login`

```json
// request
{ "email": "user@example.com", "password": "…" }
// response (200)
{ "accessToken": "eyJ…", "user": { "id": "…", "email": "…", "fullName": "…", "role": "volunteer" } }
```

Додатково встановлюються cookie: `refresh_token` (для `/auth/refresh`) і `access_token` (fallback для
нативних завантажень браузера — див. нижче).

### Токени

| Токен           | Алгоритм / TTL | Зберігання                                              | Призначення                                  |
| --------------- | -------------- | ------------------------------------------------------- | -------------------------------------------- |
| **Access JWT**  | HS256 / 15 хв  | у пам'яті фронта (Zustand), **не** localStorage         | заголовок `Authorization: Bearer <token>`    |
| **Refresh JWT** | HS256 / 30 днів| **httpOnly cookie** (`Path=/api/v1/auth`, `SameSite=Strict`) | `/auth/refresh` і `/auth/logout`        |

Refresh-payload містить `jti` (uuid) — гарантує унікальність токена при ротації й закладає основу для
майбутньої денілист-логіки. Обґрунтування схеми — [ADR-014](architecture-decisions.md#adr-014-jwt-access-у-памяті--refresh-у-httponly-cookie-з-ротацією).

### Refresh і ротація

`POST /api/v1/auth/refresh` — браузер автоматично шле cookie. Сервер:

1. перевіряє підпис refresh-токена;
2. перевіряє, що користувач `is_active = true` і не soft-deleted;
3. **ротує** refresh (видає новий і ставить нову cookie);
4. повертає новий access у тілі.

Після перезавантаження сторінки фронт робить тихий `refresh` для отримання нового access; якщо не
вдалося — редірект на `/login`.

### Access-токен у cookie + Vite-проксі

Деякі запити робить **сам браузер**, а не axios (завантаження документа, `<img>`-прев'ю, `window.open`) —
у них не підкласти `Authorization`-заголовок. Тому ([ADR-015](architecture-decisions.md#adr-015-access-токен-дублюється-в-httponly-cookie--vite-проксі-для-нативних-завантажень-браузера)):

- access-токен **додатково** кладеться в httpOnly cookie `access_token` (`Path=/api/v1`,
  `SameSite=Strict`, `Secure` у prod);
- `JwtAuthGuard` читає токен із `Authorization: Bearer`, а fallback — із cookie;
- у dev клієнт ходить на відносний `/api/v1` через **Vite dev-proxy** (`/api → http://localhost:3000`),
  тож усе стає same-origin і cookie — first-party (`SameSite=Strict` працює без HTTPS).

### Паролі

- **bcrypt** із cost factor із ENV (`BCRYPT_COST`, default 12). Перевірка через `bcrypt.compare()`.
- Пароль ніколи не повертається в API.

### Reset пароля (admin)

`POST /api/v1/users/:id/reset-password` (тільки admin): генерує новий випадковий пароль, хешує й записує,
**одноразово** повертає його у відповіді (адмін показує користувачу в UI й передає зручним каналом).
Власне self-service відновлення через e-mail — поза межами першої версії.

## Авторизація (RBAC)

`JwtAuthGuard` підключений глобально через `APP_GUARD`; `@Public()` пропускає його (login, refresh,
health, `/public/*`). `RolesGuard` читає метадані `@Roles(...)`:

```ts
@Controller('vehicles')
export class VehiclesController {
  @Get() @Roles('admin', 'volunteer', 'guest') list() { /* ... */ }
  @Post() @Roles('admin', 'volunteer') create() { /* ... */ }
  @Delete(':id') @Roles('admin') remove() { /* ... */ }
}
```

`@CurrentUser()` витягує `{ sub, email, role }` з валідованого токена.

**Bіл-рівнева авторизація.** Гранулярні правила перевіряються у сервісі — наприклад, доступ до документа:

```ts
if (user.role !== 'admin' && doc.createdBy !== user.id) {
  throw new ForbiddenException('NOT_OWNER');
}
```

## Безпекові механізми

| Механізм                | Реалізація                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| **HTTPS**               | Обов'язково в проді (TLS на reverse proxy). У dev — HTTP; cookie `Secure` лише в проді.       |
| **Заголовки**           | `helmet()` — HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, CSP та інші.           |
| **CORS**                | `origin = CORS_ORIGIN`, `credentials: true` (для cookie).                                    |
| **Валідація вводу**     | `ZodValidationPipe` на body/query/params; зайві поля відсікаються.                           |
| **SQL-ін'єкції**        | Drizzle — параметризовані запити; прямі рядкові SQL заборонені.                              |
| **XSS**                 | React екранує текст; `dangerouslySetInnerHTML` заборонено; CSP блокує inline-скрипти.        |
| **CSRF**                | `SameSite=Strict` на cookie + same-origin proxy. Повноцінний token/double-submit — на потім. |
| **Завантаження файлів** | MIME-whitelist + content-sniffing; ліміт розміру; ключі з UUID (див. [files.md](files.md)). |
| **Аудит**               | `created_by`/`updated_by`/`deleted_by` + таймстемпи ([ADR-007](architecture-decisions.md#adr-007-мінімальний-аудит-без-таблиці-audit_log)). |
| **Секрети**             | `JWT_*_SECRET`, `DATABASE_URL`, `S3_*`, `ADMIN_PASSWORD` — у `.env` (gitignored).            |

### Валідація ENV

`apps/server/src/config/env.schema.ts` валідує `process.env` через zod на старті — наприклад,
`JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` мають бути ≥ 32 символи, `CORS_ORIGIN` і `S3_ENDPOINT` — валідні
URL. Невалідне середовище → застосунок не стартує з осмисленим повідомленням.

## Свідомий борг і майбутні розширення

- Повноцінний CSRF-захист (token / double-submit) для cookie-auth.
- Денілист refresh-токенів для миттєвого logout усіх пристроїв.
- Rate limiting на `/auth/login` та write-операціях (`@nestjs/throttler`).
- Self-service відновлення пароля через e-mail.
- Розширений `audit_log` з diff; 2FA (TOTP); шифрування файлів at-rest.
- `pnpm audit` залежностей у CI.
