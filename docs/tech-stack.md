# Технологічний стек

Версії — мажорні; точні фіксуються у `package.json` кожного пакета та в `pnpm-lock.yaml`.

## Мови та середовища

| Компонент      | Версія                 | Призначення                                                        |
| -------------- | ---------------------- | ----------------------------------------------------------------- |
| **TypeScript** | `5.x` (`strict: true`) | Єдина мова коду фронтенду, бекенду й shared-пакета.               |
| **Node.js**    | `22.x LTS`             | Рантайм бекенду й build-інструментів.                            |
| **pnpm**       | `9.x`                  | Менеджер пакетів для monorepo (спільний store, hard links).      |

Версії інструментів фіксуються у `.nvmrc` (`22`), `.mise.toml` (node + pnpm) і `packageManager`/`engines`
у кореневому `package.json`.

## Frontend

| Компонент            | Версія                    | Роль                                                                         |
| -------------------- | ------------------------- | ---------------------------------------------------------------------------- |
| **React**            | `18.x`                    | UI-бібліотека.                                                               |
| **Vite**             | `5.x`                     | Dev-сервер (HMR, dev-proxy `/api`) і збірка SPA.                             |
| **Ant Design**       | `5.x`                     | UI-кіт: `Layout`, `Table`, `Form`, `Modal`, `Upload`, `DatePicker` тощо.    |
| **TanStack Query**   | `5.x`                     | Серверний стан: кеш, інвалідація, retry.                                     |
| **Zustand**          | `4.x`                     | Невеликий глобальний UI-стан (auth, модалки, фільтри).                       |
| **react-router**     | `6.x` (data router)       | Маршрутизація SPA.                                                           |
| **zod**              | `3.x`                     | Валідація форм; спільні схеми з `@volunteerfleet/shared`.                    |
| **dayjs**            | `1.x` + `locale/uk`       | Дати (Ant Design `DatePicker` працює на dayjs).                              |
| **axios**            | `1.x`                     | HTTP-клієнт з interceptors (refresh на 401).                                 |

## Backend

| Компонент                                 | Версія         | Роль                                                              |
| ----------------------------------------- | -------------- | ----------------------------------------------------------------- |
| **NestJS**                                | `10.x`         | Серверний фреймворк: DI, guards, interceptors, pipes.             |
| **Express**                               | (адаптер Nest) | HTTP-сервер під NestJS.                                          |
| **Drizzle ORM**                           | `0.3x`         | Type-safe SQL builder для PostgreSQL; схема в TS.                |
| **drizzle-kit**                           | `0.2x`         | Генерація й застосування SQL-міграцій.                          |
| **pg**                                    | `8.x`          | Драйвер PostgreSQL.                                              |
| **zod** + **nestjs-zod**                  | `3.x`          | DTO-схеми, `ZodValidationPipe`, генерація OpenAPI.              |
| **@nestjs/swagger**                       | `7.x`          | Swagger UI на `/api/v1/docs`.                                    |
| **@nestjs/jwt** + **passport-jwt**        | `10.x` / `4.x` | Видача та валідація JWT.                                         |
| **@nestjs/config**                        | `3.x`          | Завантаження ENV; валідація через zod (`env.schema.ts`).        |
| **bcrypt**                                | `5.x`          | Хешування паролів (cost factor з ENV).                          |
| **@aws-sdk/client-s3**                    | `3.x`          | Клієнт S3 — MinIO локально, будь-який S3-сумісний у проді.      |
| **multer** + **@nestjs/platform-express** | —              | Multipart upload.                                               |
| **file-type**                             | —              | Content-sniffing MIME при завантаженні файлів.                 |
| **@swc/core** + **@swc/cli**              | `1.x`          | ESM-native builder (швидша компіляція + decoratorMetadata).    |
| **helmet**, **cookie-parser**             | —              | Безпекові заголовки; читання cookie.                            |

## База даних та сховище

| Компонент      | Версія               | Роль                                            |
| -------------- | -------------------- | ----------------------------------------------- |
| **PostgreSQL** | `16.x`               | Основна СУБД (Docker-образ `postgres:16-alpine`). |
| **MinIO**      | `latest`             | Локальне S3-сумісне сховище (`minio/minio`).    |

## Інструменти якості та CI

| Компонент                  | Роль                                       |
| -------------------------- | ------------------------------------------ |
| **ESLint** `9.x` (flat)    | Лінтер для TS/React.                       |
| **Prettier** `3.x`         | Автоформатування.                          |
| **Husky** + **lint-staged**| Pre-commit: lint + format на staged-файлах.|
| **Vitest** `1.x`           | Тестовий runner для BE і FE.               |
| **@testing-library/react** | Component-тести фронтенду.                 |
| **Docker** + **Compose**   | PostgreSQL + MinIO (+ опц. pgAdmin) локально.|
| **GitHub Actions**         | CI: lint, typecheck, tests на push/PR.     |

## Обґрунтування нестандартних виборів

Коротко; повні ADR — у [architecture-decisions.md](architecture-decisions.md).

- **Drizzle, а не TypeORM/Prisma** — type-safe SQL без runtime-генерації й окремого engine; схема в TS —
  джерело правди для міграцій. ([ADR-004](architecture-decisions.md#adr-004-drizzle-orm-замість-typeormprisma))
- **Zustand, а не Redux** — глобального UI-стану мало; Redux дав би boilerplate без виграшу.
  ([ADR-021](architecture-decisions.md#adr-021-розподіл-стану-на-клієнті-tanstack-query-server-state--zustand-ui-state))
- **TanStack Query** для серверного стану — кеш/інвалідація/retry без власного коду.
- **MinIO** для файлів — той самий S3 API, що й AWS/R2/B2 у проді. ([ADR-017](architecture-decisions.md#adr-017-файли--через-s3-сумісне-сховище-minio-з-presigned-завантаженням))
- **Print-stylesheet, а не PDF-бібліотека** — без headless Chromium, кирилиця «з коробки». ([ADR-018](architecture-decisions.md#adr-018-звіти-через-print-stylesheet-без-pdf-бібліотеки))
- **ESM + SWC** на сервері — єдиний модульний стандарт із shared, швидший білд. ([ADR-003](architecture-decisions.md#adr-003-esm-як-єдиний-стандарт-модулів-сервера))

## Що свідомо не використовуємо

| Технологія              | Чому ні                                                                       |
| ----------------------- | ------------------------------------------------------------------------------ |
| Redux / RTK             | Overkill за наявного обсягу глобального стану.                                 |
| GraphQL                 | REST покриває потреби без додаткової складності.                              |
| Мікросервіси            | Обсяг домену не виправдовує мережевих меж (модульний моноліт).                |
| WebSockets / SSE        | Немає real-time-сценаріїв.                                                     |
| SSR / Next.js           | Внутрішній інструмент; SEO не потрібне, SSR ускладнив би деплой.              |
| i18next                 | UI лише українською; бібліотека i18n надлишкова.                              |
| puppeteer / pdfkit      | Замінено print-stylesheet.                                                    |
| Redis                   | Кеш на цьому етапі не потрібен.                                               |
| Окрема email-служба     | Відновлення пароля — поза межами першої версії (адмін скидає вручну).         |
