---
id: VSF-5
epic: vehicle-status-flow
phase: 0
type: refactor
status: done
depends_on: [VSF-3, VSF-4]
parallelizable: false
branch: refactor/vsf-5-drop-vehicle-statuses
pr:
---

# VSF-5 — Видалення таблиці `vehicle_statuses` + перевід споживачів на enum

**Епік:** [vehicle-status-flow](../vehicle-status-flow.md) · **Фаза 0** · **Залежності:** VSF-3, VSF-4

## Мета

Прибрати довідник статусів повністю й перевести всіх його споживачів на enum + `VEHICLE_STATUS_CONFIG`.

## Обсяг

- Видалити таблицю `vehicle_statuses` зі схеми; `VehicleStatusesService`, `VehicleStatusesController`.
- Прибрати зі `shared`: `vehicleStatusCreateSchema`, `vehicleStatusUpdateSchema`, `vehicleStatusSchema`, `VEHICLE_STATUS_KINDS`; видалити `vehicleStatusKindEnum`.
- Оновити seeds: прибрати `seedVehicleStatuses`, `SEED_VEHICLE_STATUS_IDS` (повний reset міграцій/seed-demo — у [VSF-17](VSF-17.md)).
- Перевести на enum + config: `DashboardService` (групування через `VEHICLE_STATUS_DASHBOARD_GROUP` замість колонки `kind`), dashboard shared schemas, `ReportsService`, public vehicle API, тестові fixtures.

## Критерії приймання

- Жодних runtime-згадок `vehicle_statuses`, `statusId`, `vehicleStatusKind`.
- Dashboard/reports/public API працюють на enum; `db:migrate && db:seed` і білд зелені.

## Релевантні файли

- [`apps/server/src/db/schema/dictionaries.ts`](../../../apps/server/src/db/schema/dictionaries.ts), [`enums.ts`](../../../apps/server/src/db/schema/enums.ts)
- `apps/server/src/modules/dictionaries/` (vehicle-statuses service/controller)
- [`apps/server/src/modules/dashboard/dashboard.service.ts`](../../../apps/server/src/modules/dashboard/dashboard.service.ts)
- [`apps/server/src/modules/reports/reports.service.ts`](../../../apps/server/src/modules/reports/reports.service.ts), [`public.service.ts`](../../../apps/server/src/modules/public/public.service.ts)
- [`packages/shared/src/schemas/dashboard.ts`](../../../packages/shared/src/schemas/dashboard.ts), [`report.ts`](../../../packages/shared/src/schemas/report.ts), [`public.ts`](../../../packages/shared/src/schemas/public.ts)
