---
id: VSF-1
epic: vehicle-status-flow
phase: 0
type: feat
status: todo
depends_on: []
parallelizable: false
branch: feat/vsf-1-status-enum-shared
pr:
---

# VSF-1 — Enum `vehicle_status` + константи + shared-типи

**Епік:** [vehicle-status-flow](../vehicle-status-flow.md) · **Фаза 0** · **Залежності:** — (org-епік завершено)

## Мета

Захардкодити статуси як Postgres enum замість довідника й завести shared-контракти, на яких будується весь епік.

## Обсяг

- Postgres enum `vehicle_status` (`new, paid, in_transit, arrived, in_repair, ready, transferred, returned, lost`) у Drizzle-схемі (`enums.ts`).
- У `packages/shared`: `VEHICLE_STATUSES`, тип `VehicleStatus`, `VEHICLE_STATUS_CONFIG` (`label` uk, `color`, `sortOrder`) — розд. 8 епіку.
- `VEHICLE_STATUS_DASHBOARD_GROUP: Record<VehicleStatus, 'in_work' | 'final' | 'other'>` — заміна видаленого `kind` (розд. 3 п.3).
- Матриця дозволених переходів `ALLOWED_TRANSITIONS` у shared (розд. 4.2).
- Zod-схеми transition request/response як **strict discriminated union за `targetStatus`** (розд. 7); кожна гілка — strict object.
- Прибрати `vehicleStatusKindEnum` з `enums.ts`.
- Unit-тести матриці переходів і status-specific schemas.

> Міграцію вручну тут **не** генеруємо — консолідується у [VSF-17](VSF-17.md).

## Критерії приймання

- Типи/константи/матриця експортуються зі `shared`; `pnpm -w typecheck` зелений.
- Discriminated union відхиляє поля іншого переходу (не мовчки видаляє).
- Тести матриці й схем зелені.

## Релевантні файли

- [`apps/server/src/db/schema/enums.ts`](../../../apps/server/src/db/schema/enums.ts)
- `packages/shared/src/schemas/vehicle-status.ts` (новий), [`schemas/index.ts`](../../../packages/shared/src/schemas/index.ts)
- `packages/shared/src/constants/` — статус-константи
