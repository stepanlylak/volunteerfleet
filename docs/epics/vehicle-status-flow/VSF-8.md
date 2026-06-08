---
id: VSF-8
epic: vehicle-status-flow
phase: 1
type: feat
status: todo
depends_on: [VSF-6]
parallelizable: true
branch: feat/vsf-8-alerts-view
pr:
---

# VSF-8 — Обчислення алертів (Backend, slim-View)

**Епік:** [vehicle-status-flow](../vehicle-status-flow.md) · **Фаза 1** · **Залежності:** VSF-6

## Мета

Бекенд повертає актуальні алерти для кожного авто через SQL View; список можна фільтрувати за наявністю алертів.

## Обсяг

- Міграція з Postgres View `vehicle_alerts_view` (**slim: лише `vehicle_id`, `type`**) за логікою предикатів розд. 5.
- Описати View в Drizzle ORM (`pgView`).
- `VEHICLE_ALERT_CONFIG` (укр. `message` за `type`, **без `severity`**) у `packages/shared`.
- `VehicleAlertService`: отримання `type` з View і мапінг у повний `VehicleAlert` через конфіг (усі алерти — warning).
- `alerts: VehicleAlert[]` у `VehicleResponse`.
- Фільтр `hasAlerts` у `GET /vehicles` (`EXISTS` по View).
- Явні `status IN (...)` (не ordinal-порівняння enum); лише активні авто/документи поточної org; для циклів — FK актуального transition.
- Тести View: `lost`, `returned`, повторна передача, цикл ремонту, soft-delete, org isolation.

## Критерії приймання

- Алерти у відповіді авто; фільтрація за алертами працює; старий акт не закриває алерт нової передачі після повернення.
- UA-тексти не в БД; продуктивність запитів стабільна.

## Інваріанти

View не повертає алерти для soft-deleted авто, не враховує soft-deleted документи; усі зв'язки обмежені `organization_id`.

## Релевантні файли

- `apps/server/drizzle/` (міграція з View), `apps/server/src/db/schema/` (`pgView`)
- `apps/server/src/modules/vehicles/vehicle-alert.service.ts` (новий)
- [`apps/server/src/modules/vehicles/vehicles.service.ts`](../../../apps/server/src/modules/vehicles/vehicles.service.ts)
- `packages/shared/src/schemas/vehicle-alert.ts` (новий)
