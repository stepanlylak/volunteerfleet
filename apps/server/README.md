# @volunteerfleet/server

NestJS backend for VolunteerFleet.

## Quickstart

**Prerequisites:** Node 22+, pnpm 9.x, Docker + Docker Compose.

```bash
# From monorepo root:

# 1. Install dependencies
pnpm install

# 2. Copy and configure environment
cp .env.example .env
# Edit .env: set JWT_ACCESS_SECRET, JWT_REFRESH_SECRET (min 32 chars),
#            ADMIN_PASSWORD, MINIO_ROOT_PASSWORD, etc.

# 3. Start Postgres + MinIO
pnpm infra:up

# 4. Apply DB migrations
pnpm db:migrate

# 5. Seed admin user + base dictionaries
pnpm db:seed

# 6. Start the server (watch mode)
pnpm --filter @volunteerfleet/server dev
# or start everything:
pnpm dev
```

Server starts at: http://localhost:3000
API base path: http://localhost:3000/api/v1
Swagger UI: http://localhost:3000/api/v1/docs (development only)

## Scripts

| Script      | Description                                |
| ----------- | ------------------------------------------ |
| `dev`       | Start in watch mode (`nest start --watch`) |
| `start`     | Start once                                 |
| `build`     | Build to `dist/`                           |
| `typecheck` | Run TypeScript type-check (no emit)        |
| `lint`      | Run ESLint                                 |
| `test`      | Run tests (Vitest)                         |
