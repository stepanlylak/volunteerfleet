# Розгортання та середовище

Гібридна модель: **бекенд і фронтенд запускаються локально через pnpm**, а інфраструктура (PostgreSQL,
MinIO) — у Docker через `docker-compose.yml` ([ADR-020](architecture-decisions.md#adr-020-гібридний-запуск-застосунки-локально-інфраструктура-в-docker)).

## Передумови

| Інструмент     | Версія         |
| -------------- | -------------- |
| Node.js        | 22 LTS         |
| pnpm           | 9.x            |
| Docker         | 24+            |
| Docker Compose | v2 (вбудоване) |

Рекомендований інструмент керування версіями — [mise](https://mise.jdx.dev/): при вході в каталог
проєкту він ставить потрібні node/pnpm із `.mise.toml` і підвантажує `.env`. Альтернатива — nvm (читає
`.nvmrc`) + `corepack enable && corepack prepare pnpm@9 --activate`.

## Перший запуск

```bash
pnpm install
cp .env.example .env          # відредагувати JWT_*_SECRET, ADMIN_PASSWORD, S3/MinIO креди
pnpm infra:up                 # PostgreSQL + MinIO (+ створення БД і bucket активного профілю)
pnpm db:migrate               # застосувати міграції
pnpm db:seed                  # admin + базові довідники
# (опційно) pnpm db:seed:demo # демо-дані
pnpm dev                      # сервер + клієнт паралельно
```

Після `pnpm dev`:

- **Frontend:** http://localhost:5173
- **API:** http://localhost:3000/api/v1
- **Swagger UI:** http://localhost:3000/api/v1/docs
- **MinIO Console:** http://localhost:9001

## Порти (defaults)

| Сервіс          | Port    | ENV-override          |
| --------------- | ------- | --------------------- |
| Frontend (Vite) | `5173`  | `--port`              |
| Backend API     | `3000`  | `PORT`                |
| PostgreSQL      | `55432` | `POSTGRES_PORT`       |
| MinIO API       | `9000`  | `MINIO_API_PORT`      |
| MinIO Console   | `9001`  | `MINIO_CONSOLE_PORT`  |
| pgAdmin (опц.)  | `5050`  | —                     |

> PostgreSQL мапиться на host-порт **55432** (не дефолтний 5432), щоб не конфліктувати з локально
> встановленим Postgres. Канонічний `DATABASE_URL` у `.env.example` уже використовує цей порт.

## Інфраструктура (`docker-compose.yml`)

Сервіси: `postgres` (`postgres:16-alpine`, healthcheck `pg_isready`), `minio` (`minio/minio`, healthcheck
`/minio/health/live`), `minio-init` (`minio/mc` — створює bucket і робить його приватним) і опційний
`pgadmin` під профілем `tools`. Volume-и: `postgres-data`, `minio-data`, `pgadmin-data`. Розширення
`pgcrypto` вмикається через `docker/postgres/init.sql` при першому створенні volume.

Команди:

```bash
pnpm infra:up      # підняти postgres+minio, створити БД активного профілю, перестворити minio-init (bucket)
pnpm infra:down    # зупинити (volumes лишаються)
pnpm infra:reset   # знести volumes і підняти заново (ЧИСТА БД!)
docker compose --profile tools up -d pgadmin   # підняти pgAdmin за потреби
```

`pnpm infra:up` не лише піднімає контейнери, а й виконує `db:ensure` (створює PostgreSQL-database з
активного `DATABASE_URL`, якщо її ще немає) і примусово перестворює `minio-init` (гарантує bucket активного
`S3_BUCKET`). Це дозволяє перемикати локальні профілі (clean / demo) зміною кількох override-змінних.

## ENV

Один `.env` у корені — спільний шаблон. Сервер читає його через `@nestjs/config` з валідацією
(`env.schema.ts`); клієнт читає `VITE_`-змінні через Vite. Повний шаблон — у `.env.example`. Ключові групи:

```bash
# App
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173

# Database (host-порт 55432)
DATABASE_URL=postgresql://volunteerfleet_user:change_me_in_local@localhost:55432/volunteerfleet_dev

# Auth (секрети ≥ 32 символи)
JWT_ACCESS_SECRET=...        JWT_ACCESS_TTL=15m
JWT_REFRESH_SECRET=...       JWT_REFRESH_TTL=30d
BCRYPT_COST=12

# First admin (seed)
ADMIN_EMAIL=admin@example.com   ADMIN_PASSWORD=change_on_first_login   ADMIN_NAME=Адміністратор

# S3 / MinIO
S3_ENDPOINT=http://localhost:9000   S3_BUCKET=volunteerfleet-documents
S3_ACCESS_KEY=minio_root            S3_SECRET_KEY=change_me_minio
MINIO_ROOT_USER=minio_root          MINIO_ROOT_PASSWORD=change_me_minio

# Misc
EXCHANGE_RATES_FILE=./data/exchange-rates.json
MAX_UPLOAD_BYTES=26214400

# Frontend — лишити відносним: клієнт ходить через Vite-проксі, щоб cookie були first-party
VITE_API_URL=/api/v1
VITE_PROXY_TARGET=http://localhost:3000
```

> `VITE_API_URL` навмисно відносний. Прямий `http://localhost:3000` зробив би запити cross-site і зламав
> би cookie-auth ([ADR-015](architecture-decisions.md#adr-015-access-токен-дублюється-в-httponly-cookie--vite-проксі-для-нативних-завантажень-браузера)).

## Health checks

- Backend: `GET /api/v1/health` — статус + перевірка з'єднань із PostgreSQL і MinIO.
- Vite dev-server: HTTP 200 на `/`.

## Production (цільовий сценарій)

Локальний запуск достатній для розробки; production-схема описана як орієнтир:

- PostgreSQL + MinIO/S3 — як окремі (managed або docker) сервіси.
- Backend — `node dist/main.js` за `pm2`/systemd; frontend — статика Vite (`apps/client/dist`) за nginx.
- Reverse proxy (nginx) із TLS перед усім: `/` → static, `/api` → backend. FE та BE — за одним доменом,
  щоб cookie лишались first-party.
- Бекапи (поза застосунком): `pg_dump -Fc` для БД, `mc mirror`/snapshot для bucket; секрети — у secret
  storage організації.

## Очистка / реінсталяція

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install
pnpm infra:reset && pnpm db:migrate && pnpm db:seed   # повний reset (втрата даних!)
```

## Поза межами першої версії

Docker-образи для BE/FE, Kubernetes/Helm, CI/CD-деплой у прод, auto-scaling, зовнішній моніторинг
(Datadog/Sentry), вбудований backup-модуль.
