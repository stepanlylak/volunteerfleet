---
id: ORG-1
epic: organizations-multitenancy
phase: 0
type: feat
status: done
depends_on: []
parallelizable: false
branch: feat/org-1-organizations-schema
pr:
---

# ORG-1 — Схема: `organizations` та `organization_members`

**Епік:** [organizations-multitenancy](../organizations-multitenancy.md) · **Фаза 0** · **Залежності:** —

## Мета

Завести базові таблиці тенантності й контракти, на яких будується весь епік.

## Обсяг

- Drizzle-схеми `organizations` та `organization_members` за розд. 4 епіку (поля, `unique
(organization_id, user_id)`, index на `user_id` і `organization_id`).
- Enum `org_role` зі значеннями `coordinator | volunteer | viewer`.
- Relations для нових таблиць.
- Zod-схеми та типи в `packages/shared` (organization, member, `orgRole`).
- Без бізнес-логіки, контролерів і сервісів.

> Міграцію тут **не** генеруємо вручну — єдина початкова міграція регенерується у [ORG-3](ORG-3.md)
> (greenfield).

## Критерії приймання

- Нові таблиці й enum описані в TS-схемі; relations підключені в `index.ts`.
- Типи й zod-схеми експортуються зі `shared`.
- `pnpm -w typecheck` зелений.

## Релевантні файли

- `apps/server/src/db/schema/organizations.ts` (новий), `organization-members.ts` (новий)
- [`apps/server/src/db/schema/enums.ts`](../../../apps/server/src/db/schema/enums.ts) — `org_role`
- [`apps/server/src/db/schema/relations.ts`](../../../apps/server/src/db/schema/relations.ts), `index.ts`
- `packages/shared/src/schemas/organization.ts` (новий), [`index.ts`](../../../packages/shared/src/schemas/index.ts)
- [`packages/shared/src/types/roles.ts`](../../../packages/shared/src/types/roles.ts)
