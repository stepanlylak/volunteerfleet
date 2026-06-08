---
id: VSF-7
epic: vehicle-status-flow
phase: 1
type: feat
status: todo
depends_on: [VSF-6]
parallelizable: true
branch: feat/vsf-7-auto-new-status
pr:
---

# VSF-7 — Автоматичний статус `new` + прибрати `statusId` з create/update

**Епік:** [vehicle-status-flow](../vehicle-status-flow.md) · **Фаза 1** · **Залежності:** VSF-6

## Мета

Статус виставляється автоматично при створенні й змінюється виключно через transition-ендпоінт.

## Обсяг

- `vehicles.create()` — статус `new` автоматично; перший запис історії `→ new` із `transition_date = start_date`.
- Прибрати `statusId` з `vehicleCreateSchema`.
- Прибрати зміну статусу з `vehicles.update()`; `vehicleUpdateSchema` без `statusId`/`status`.

## Критерії приймання

- Створення авто → статус `new`; `PATCH /vehicles/:id` не змінює статус.
- Старий флов зміни статусу через PATCH не працює (тест).

## Релевантні файли

- [`apps/server/src/modules/vehicles/vehicles.service.ts`](../../../apps/server/src/modules/vehicles/vehicles.service.ts)
- [`packages/shared/src/schemas/vehicle.ts`](../../../packages/shared/src/schemas/vehicle.ts)
