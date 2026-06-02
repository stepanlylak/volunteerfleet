# Структура репозиторію

## Загальний вигляд

```
volunteerfleet/
├── package.json                # Корінь: scripts оркестрації, workspace-конфіг, packageManager
├── pnpm-workspace.yaml         # Перелік workspace-пакетів
├── pnpm-lock.yaml              # Lockfile (у репо)
├── tsconfig.base.json          # Спільні compilerOptions
├── eslint.config.js            # Flat ESLint config (ігнорує dist)
├── .prettierrc, .editorconfig  # Форматування
├── .nvmrc, .mise.toml          # Версії Node/pnpm (+ автозавантаження .env для mise)
├── .env.example                # Шаблон ENV для всіх частин
├── docker-compose.yml          # PostgreSQL + MinIO (+ minio-init, опц. pgAdmin)
├── docker/postgres/init.sql    # Вмикає розширення pgcrypto при створенні volume
├── .husky/pre-commit           # lint-staged
├── README.md                   # Quickstart і опис проєкту
├── docs/                        # Ця документація
├── apps/
│   ├── server/                 # NestJS backend
│   └── client/                 # React + Vite SPA
└── packages/
    └── shared/                 # zod-схеми, типи, константи (спільні для BE і FE)
```

## pnpm workspace

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

Кореневий `package.json` тримає лише оркестрацію та dev-залежності інструментів. Ключові scripts:

| Скрипт            | Дія                                                                  |
| ----------------- | -------------------------------------------------------------------- |
| `dev`             | Білд `shared`, далі сервер + клієнт + `shared --watch` паралельно.   |
| `build`           | `pnpm -r build` (топологічно).                                       |
| `lint`            | ESLint по всьому репо (`--max-warnings=0`).                          |
| `typecheck`       | `tsc --noEmit` у всіх пакетах.                                       |
| `test`            | Vitest у всіх пакетах.                                               |
| `format`          | Prettier write.                                                      |
| `infra:up`        | Підняти PostgreSQL + MinIO, створити БД і bucket активного профілю.  |
| `infra:down`      | Зупинити контейнери (volumes лишаються).                             |
| `infra:reset`     | Знести volumes і підняти заново (чиста БД!).                         |
| `db:generate`     | `drizzle-kit generate` — нова міграція з diff схеми.                 |
| `db:migrate`      | Застосувати міграції.                                                |
| `db:seed`         | Admin + базові довідники.                                            |
| `db:seed:demo`    | Демо-дані (авто, витрати, документи).                                |

> `shared` будується ESM-only й має бути зібраний перед першим стартом сервера. Кореневий `dev`
> гарантує це: спершу разовий `--filter shared build`, далі `shared` у watch-режимі поряд із apps.

## `apps/server` — NestJS

```
apps/server/
├── package.json                # @volunteerfleet/server, "type": "module"
├── tsconfig.json               # NodeNext, ES2022
├── nest-cli.json               # SWC builder + typeCheck
├── .swcrc                      # ES2022, ES6 modules, decoratorMetadata
├── drizzle.config.ts           # Конфіг drizzle-kit
├── data/exchange-rates.json    # Помісячні курси валют (див. currency.md)
├── drizzle/                    # Згенеровані SQL-міграції (commit-ються) + meta/
└── src/
    ├── main.ts                 # Bootstrap: prefix, helmet, cookieParser, CORS, ZodValidationPipe, Swagger
    ├── app.module.ts           # Корінь модулів
    ├── app.controller.ts
    ├── config/                 # ConfigModule + env.schema.ts (zod-валідація process.env)
    ├── db/
    │   ├── client.ts           # createDb(): pg.Pool + drizzle
    │   ├── db.module.ts        # @Global() провайдер (DB, DB_POOL)
    │   ├── helpers.ts          # notDeleted(), soft-delete та audit-утиліти
    │   └── schema/             # Файл на сутність + enums.ts + relations.ts
    ├── common/                 # guards (jwt-auth, roles), decorators (@Public, @Roles, @CurrentUser), filters
    ├── storage/                # S3/MinIO: storage.module, storage.service, storage.tokens
    ├── health/                 # /api/v1/health
    ├── modules/                # Бізнес-модулі (див. нижче)
    └── scripts/                # seed.ts, seed-demo.ts, seed-ids.ts, ensure-database.ts
```

**Бізнес-модулі** (`src/modules/`): `auth`, `users`, `vehicles` (+ `vehicle-photos.service`),
`expenses`, `documents`, `dictionaries` (vehicle-statuses, expense-categories, funding-sources),
`exchange-rates`, `reports`, `dashboard`, `public`.

Типовий модуль усередині:

```
modules/vehicles/
├── vehicles.module.ts
├── vehicles.controller.ts
├── vehicles.service.ts
└── vehicles.service.spec.ts    # unit-тести
```

DTO-схеми re-export-яться з `@volunteerfleet/shared`, доменно-специфічні — поруч у модулі.

## `apps/client` — React + Vite

```
apps/client/
├── package.json                # @volunteerfleet/client
├── vite.config.ts              # React-плагін + dev-proxy /api → server
├── index.html
├── public/                     # Лого та статика
└── src/
    ├── main.tsx                # ConfigProvider (antd uk_UA) + QueryClient + RouterProvider
    ├── router.tsx              # Конфіг react-router (back-office + /public + error pages)
    ├── api/                    # axios client + обгортки ендпоінтів (auth, vehicles, expenses, ...)
    ├── hooks/                  # RQ-хуки (useVehicles, useExpenses, useDashboard, ...)
    ├── stores/                 # Zustand: auth.store, ui.store
    ├── components/             # guards (AuthGuard, RoleGuard), layout, reports, files
    ├── pages/                  # Сторінки (login, dashboard, vehicles, expenses, reports, admin, public, errors)
    ├── modals/                 # Модальні форми (Vehicle, Expense, Document, User, DictionaryItem)
    ├── styles/                 # global.css, print.css, theme.ts
    └── utils/                  # format, zod-antd адаптер, helpers
```

## `packages/shared`

```
packages/shared/
├── package.json                # "type": "module"; conditional exports (types → src, import → dist)
└── src/
    ├── index.ts                # Барель
    ├── schemas/                # zod-схеми: auth, user, vehicle, vehicle-photo, expense, document,
    │                           #   dictionary, report, dashboard, exchange-rate, public, pagination, common
    ├── types/                  # roles, jwt — типи поза zod
    └── constants/              # currencies (UAH|USD|EUR + BASE_CURRENCY), routes (API_BASE, PUBLIC_ROUTE_PREFIX)
```

Імпорт в обох застосунках — через пакетне ім'я:

```ts
import { vehicleCreateSchema, type VehicleCreate } from '@volunteerfleet/shared';
```

Workspace-залежність у `apps/*/package.json`: `"@volunteerfleet/shared": "workspace:*"`.

## TypeScript-конфіги

- **Корінь `tsconfig.base.json`** — спільні `compilerOptions` (`strict: true`, `target: ES2022`).
- Кожен пакет має власний `tsconfig.json` (`extends` базового) з власними `include`/`exclude`.
- `apps/server` — NodeNext-резолв; `@volunteerfleet/shared` резолвиться через `exports` пакета, не через
  TS path mapping (див. [ADR-003](architecture-decisions.md#adr-003-esm-як-єдиний-стандарт-модулів-сервера)).

## Що тримаємо в git, а що ні

Не ігнорувати (важливо):

- `pnpm-lock.yaml`,
- `apps/server/drizzle/` (згенеровані міграції),
- `apps/server/data/exchange-rates.json`,
- `.env.example`.

Ігнорується: `node_modules/`, `dist/`, `build/`, `coverage/`, `.vite/`, `*.tsbuildinfo`, `.env` (крім
`.env.example`), локальні `.mise.local.toml`, `.claude/settings.local.json`.

## Готовність до розширення

Структура дозволяє без зміни workspace-конфігу:

- додати `apps/mobile/` (React Native);
- винести окремий `apps/server/modules/<x>/` у самостійний сервіс (модульний моноліт → сервіси);
- додати `packages/ui/` зі спільними React-компонентами.
