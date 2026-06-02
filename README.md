# VolunteerFleet

Web platform for tracking vehicles donated to the Armed Forces of Ukraine by volunteer initiatives — a unified registry of vehicles, expenses, supporting documents, and donor-facing reports.

> **Status:** early development. Core MVP is being built; APIs, schema, and UI may change without notice.

## What it does

- Registry of vehicles (passport data, status, photos).
- Expense tracking per vehicle with multi-currency support (UAH base, USD / EUR with monthly rates).
- Document storage (PDFs, scans, photos) with presigned downloads.
- Reports for donors: per-vehicle history, totals, exports.
- Role-based access (admin / volunteer / read-only).

## Stack

- **Monorepo:** pnpm workspaces (`apps/server`, `apps/client`, `packages/shared`).
- **Backend:** NestJS, TypeScript, Drizzle ORM, PostgreSQL 16, Zod, JWT (access + refresh httpOnly), `@aws-sdk/client-s3` (MinIO).
- **Frontend:** React 18, Vite, Ant Design v5, TanStack Query, Zustand, React Router v6.
- **Files:** MinIO via docker-compose; upload + presigned download.
- **API:** REST `/api/v1`, OpenAPI generated from Zod schemas.
- **Tests:** Vitest (BE + FE). Lint: ESLint + Prettier. Hooks: Husky + lint-staged. CI: GitHub Actions.

## Requirements

- Node.js ≥ 22
- pnpm ≥ 9
- Docker (for Postgres + MinIO)

[mise](https://mise.jdx.dev/) is recommended for managing tool versions — the repo ships a `.mise.toml`. Alternative: `nvm` + `corepack`.

## Quickstart

```bash
pnpm install
cp .env.example .env       # adjust as needed
pnpm infra:up              # Postgres + MinIO in Docker
pnpm db:migrate
pnpm db:seed               # creates admin user and base dictionaries
pnpm dev                   # server + client in parallel
```

Default ports: client `5173`, server `3000`, Postgres `55432`, MinIO `9000` (API) / `9001` (console).

## Scripts

| Command           | Description                                  |
| ----------------- | -------------------------------------------- |
| `pnpm dev`        | Run server and client in parallel            |
| `pnpm build`      | Build all workspaces                         |
| `pnpm lint`       | ESLint across the monorepo (zero warnings)   |
| `pnpm typecheck`  | TypeScript checks in all workspaces          |
| `pnpm test`       | Vitest in all workspaces                     |
| `pnpm format`     | Prettier write                               |
| `pnpm infra:up`   | Start Postgres + MinIO containers            |
| `pnpm infra:down` | Stop containers (volumes kept)               |
| `pnpm db:migrate` | Apply Drizzle migrations                     |
| `pnpm db:seed`    | Seed admin user + reference data             |

## Project layout

```
apps/
  server/      NestJS API
  client/      React + Vite SPA
packages/
  shared/      Shared types and Zod schemas
docker/        Local infrastructure configs
docs/          Technical documentation
```

## Contributing

Issues and PRs are welcome. The project is in active early development — please open an issue before starting significant work so we can align on direction.

## License

[MIT](./LICENSE)
