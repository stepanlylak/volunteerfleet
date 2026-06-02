# @volunteerfleet/shared

Workspace package with shared definitions used by both backend (`apps/server`) and frontend (`apps/client`):

- **Zod schemas** — DTO source of truth for request/response validation.
- **TypeScript types and enums** — auth roles, JWT payloads, etc.
- **Constants** — currency codes, API route prefixes.

Consumed via TypeScript path aliases (`@volunteerfleet/shared`) configured in `tsconfig.base.json`, without a separate build step in dev.
