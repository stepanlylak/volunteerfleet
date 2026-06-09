---
id: VSF-3
epic: vehicle-status-flow
phase: 0
type: feat
status: done
depends_on: [VSF-1]
parallelizable: true
branch: feat/vsf-3-vehicles-status-enum
pr:
---

# VSF-3 — Міграція `vehicles`: `statusId` → `status` enum (+ `start_date`)

**Епік:** [vehicle-status-flow](../vehicle-status-flow.md) · **Фаза 0** · **Залежності:** VSF-1 (паралельно з VSF-2)

## Мета

Замінити FK на довідник enum-колонкою та звільнити `border_crossing_date` для прямого призначення.

## Обсяг

- `vehicles.status vehicle_status NOT NULL DEFAULT 'new'`; видалити `vehicles.statusId` і `vehicles_status_id_idx`, додати `vehicles_status_idx`.
- Додати `start_date date NOT NULL` — початкова дата авто (заповнюється при створенні).
- `border_crossing_date date NULL` лишається, але **прибирається з create-схеми** (заповнюється згодом, при `→ arrived` — див. [VSF-6](VSF-6.md)).
- Оновити shared vehicle schemas: `statusId → status`, додати `startDate`; `vehicleCreateSchema`/`vehicleUpdateSchema`/`vehicleResponseSchema`/list schemas.

## Критерії приймання

- `vehicles` використовує enum; `start_date` обов'язковий; `border_crossing_date` не у create-схемі.
- `pnpm -w typecheck` зелений.

## Релевантні файли

- [`apps/server/src/db/schema/vehicles.ts`](../../../apps/server/src/db/schema/vehicles.ts)
- [`packages/shared/src/schemas/vehicle.ts`](../../../packages/shared/src/schemas/vehicle.ts)
- [`apps/server/src/modules/vehicles/vehicles.service.ts`](../../../apps/server/src/modules/vehicles/vehicles.service.ts)
