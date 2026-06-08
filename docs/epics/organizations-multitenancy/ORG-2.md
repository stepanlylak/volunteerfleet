---
id: ORG-2
epic: organizations-multitenancy
phase: 0
type: feat
status: ready
depends_on: [ORG-1]
parallelizable: true
branch:
pr:
---

# ORG-2 — Схема tenant-таблиць: `organization_id`, drop `public_slug`, `last_active_org_id`

**Епік:** [organizations-multitenancy](../organizations-multitenancy.md) · **Фаза 0** · **Залежності:** ORG-1
(можна паралельно з ORG-4)

## Мета

Привести наявні сутності до цільового вигляду схеми (greenfield — одразу фінальний стан).

## Обсяг

- `organization_id uuid NOT NULL → organizations` + index на: `vehicles`, `expenses`, `documents`,
  `vehicle_photos`, `vehicle_status_history`.
- **Прибрати** `vehicles.public_slug` і індекс `vehicles_public_slug_active_unique`.
- Додати `users.last_active_org_id uuid null → organizations`.
- Оновити relations.
- Залежний код (service/public/frontend) чиститься у [ORG-7](ORG-7.md)/[ORG-11](ORG-11.md)/[ORG-14](ORG-14.md)
  — тут лише схема.

## Критерії приймання

- Схема відображає розд. 4 епіку; `typecheck` зелений.
- Жодних згадок `public_slug` у схемі.

## Релевантні файли

- [`vehicles.ts`](../../../apps/server/src/db/schema/vehicles.ts), [`expenses.ts`](../../../apps/server/src/db/schema/expenses.ts),
  [`documents.ts`](../../../apps/server/src/db/schema/documents.ts), `vehicle-photos.ts`, `vehicle-status-history.ts`
- [`users.ts`](../../../apps/server/src/db/schema/users.ts) — `last_active_org_id`
- [`relations.ts`](../../../apps/server/src/db/schema/relations.ts)
