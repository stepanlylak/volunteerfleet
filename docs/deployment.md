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

| Сервіс          | Port    | ENV-override         |
| --------------- | ------- | -------------------- |
| Frontend (Vite) | `5173`  | `--port`             |
| Backend API     | `3000`  | `PORT`               |
| PostgreSQL      | `55432` | `POSTGRES_PORT`      |
| MinIO API       | `9000`  | `MINIO_API_PORT`     |
| MinIO Console   | `9001`  | `MINIO_CONSOLE_PORT` |
| pgAdmin (опц.)  | `5050`  | —                    |

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

## Production (Docker + Zoraxy на одному VPS)

Прод-схема: застосунок збирається в один Docker-образ і піднімається разом із PostgreSQL та MinIO
через `docker-compose.prod.yml`. Reverse proxy і TLS — зовнішній (Zoraxy), налаштовується вручну.

### Архітектура

- **`volunteerfleet`** — один контейнер: NestJS-API + зібраний SPA на одному порту (`3000`). FE і BE на
  одному origin → cookie-auth лишається first-party. У production сервер сам віддає статику клієнта
  (`useStaticAssets`); CSP у helmet вимкнено (інакше AntD inline-стилі й cross-origin URL з MinIO блокуються).
- **`volunteerfleet-postgres`** — лише у приватній мережі `internal`, назовні не публікується (ізольований
  від інших стеків на сервері).
- **`volunteerfleet-minio`** — об'єктне сховище документів/фото.
- **Мережі:** `volunteerfleet` і `minio` додатково під'єднані до зовнішньої `n8n_default` (де працює Zoraxy)
  — Zoraxy маршрутизує за іменем контейнера, **host-порти не публікуються** (нуль колізій із дефолтними
  портами інших апок).
- **Стан:** лише `./data/postgres` і `./data/minio` (bind-mounts на сервері) — переживають оновлення образу.

### Реліз: від `main` до образу в GHCR

Версія = git-тег `vX.Y.Z`. Пуш тегу запускає workflow
[`release.yml`](../.github/workflows/release.yml), який збирає образ і пушить у GHCR.

```bash
# 0. Актуальний main
git checkout main
git fetch origin
git pull --ff-only origin main

# 1. Реліз-гілка від main (стабілізація, бамп версій, CHANGELOG, фінальні фікси)
git checkout -b release/1.2.0
git push -u origin release/1.2.0

# 2. Анотований тег на готовому коміті + пуш тегу — це і є тригер CI
git tag -a v1.2.0 -m "Release 1.2.0"
git push origin v1.2.0
```

Тег `v1.2.0` → GitHub Actions збирає й пушить три теги одного образу:
`ghcr.io/<owner>/volunteerfleet:1.2.0`, `:1.2`, `:latest`.

```bash
# 3. Слідкувати за збіркою
gh run watch                       # або: gh run list --workflow=release.yml

# 4. (ПЕРШИЙ РАЗ) дати доступ до пакета:
#    GitHub → сторінка пакета volunteerfleet → Package settings → Visibility → Public;
#    або лишити Private і залогінити VPS PAT-ом із правом read:packages:
#    echo <PAT> | docker login ghcr.io -u <owner> --password-stdin

# 5. Переконатися, що образ доступний
docker pull ghcr.io/<owner>/volunteerfleet:1.2.0

# 6. Влити реліз-гілку назад у main (через PR або локально)
git checkout main && git merge --no-ff release/1.2.0 && git push origin main
```

Далі — деплой на VPS: підняти `VF_IMAGE` у `.env` і запустити `./update.sh`
(див. [«Оновлення на новий реліз»](#оновлення-на-новий-реліз)).

> CI пушить у GHCR через вбудований `GITHUB_TOKEN` (`packages: write` уже задано в workflow) —
> окремих секретів не треба. Приватний образ потребує `docker login ghcr.io` на VPS (PAT із `read:packages`).

### Перший деплой на VPS

Передумови: Docker + Docker Compose v2; Zoraxy вже у мережі `n8n_default`; DNS обох доменів вказує на сервер.

```bash
mkdir -p /opt/volunteerfleet && cd /opt/volunteerfleet
# покласти поряд: docker-compose.prod.yml, docker/postgres/init.sql, update.sh, backup.sh
cp .env.prod.example .env        # заповнити секрети, домени, VF_IMAGE
mkdir -p data/postgres data/minio
docker login ghcr.io             # якщо образ приватний
docker compose -f docker-compose.prod.yml up -d
```

Entrypoint образу на старті сам **накатує міграції** і **робить seed** (ідемпотентно) — ручних кроків немає.

### Налаштування Zoraxy

- Основний домен (= `CORS_ORIGIN`) → `volunteerfleet:3000`.
- Files-домен (= `S3_ENDPOINT`) → `volunteerfleet-minio:9000`, **з передачею оригінального `Host`** — інакше
  підпис presigned-URL не зійдеться і завантаження документів/фото не працюватимуть.
- TLS на обох доменах — у Zoraxy.

### Оновлення на новий реліз

```bash
cd /opt/volunteerfleet
# (за потреби) підняти тег у .env: VF_IMAGE=ghcr.io/<owner>/volunteerfleet:1.3.0
./update.sh
```

`update.sh`: робить дамп БД у `backups/` → `docker compose pull` → `up -d` (міграції накочуються
автоматично на старті) → чистить старі образи. Дані в `./data/*` не чіпаються.

**Відкат:** повернути попередній тег у `.env` і знову `./update.sh`. Застереження: міграції forward-only —
відкат образу **не відкочує схему БД**, тож нова версія коду має лишатися сумісною з попередньою схемою; у
крайньому разі відновлюй з дампа (нижче).

### Дані, міграції та безпека оновлень

- **Схема-міграції — тільки додавальні (append-only):** жодних `DROP`/ресетів даних; накочуються автоматично
  і йдуть лише вперед. **Не редагуй уже випущені міграції** — мігратор звіряє журнал-хеші.
- **Seed — insert-only по `id`:** створює відсутні довідники й першого адміна, **існуючі рядки не чіпає**
  (перейменовані/перефарбовані статуси, сортування, `is_default` зберігаються), пароль адміна **не скидає**.
  Тому безпечний для запуску на кожному старті контейнера.

> **Два мігратори, один механізм.** Нові міграції генеруються локально через `drizzle-kit`
> (`pnpm db:generate`) і комітяться як SQL у `apps/server/drizzle/`. Застосовує їх: у dev — `pnpm db:migrate`
> (drizzle-kit), у проді — програмний мігратор `drizzle-orm` в образі (`dist/scripts/migrate.js`, без
> drizzle-kit, бо це devDependency). Обидва читають той самий журнал і таблицю `__drizzle_migrations`, тож
> повністю взаємозамінні — dev-флоу не змінюється.

### Бекапи / відновлення

- `./backup.sh` — разовий дамп БД у `backups/db-<ts>.dump` (`pg_dump -Fc`). `update.sh` робить такий дамп
  автоматично перед кожним оновленням.
- **Відновлення БД** (у запущений контейнер):

  ```bash
  docker compose -f docker-compose.prod.yml exec -T volunteerfleet-postgres \
    sh -c 'pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backups/db-<ts>.dump
  ```

- **MinIO** — це звичайні файли в `./data/minio`; бекап роби файловим інструментом (restic/rsync/`tar`).
- Рекомендується крон: щоденний `backup.sh` + офсайт-копія `data/minio`.

## Очистка / реінсталяція

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install
pnpm infra:reset && pnpm db:migrate && pnpm db:seed   # повний reset (втрата даних!)
```

## Поза межами першої версії

Kubernetes/Helm, auto-scaling, zero-downtime/rolling-деплой, зовнішній моніторинг (Datadog/Sentry),
вбудований у застосунок backup-модуль, автоматичний CD на VPS (зараз — ручний `update.sh`).
