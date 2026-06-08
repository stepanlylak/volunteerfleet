---
id: VSF-10
epic: vehicle-status-flow
phase: 2
type: feat
status: todo
depends_on: [VSF-8, VSF-9]
parallelizable: true
branch: feat/vsf-10-alerts-on-vehicle-card
pr:
---

# VSF-10 — Алерти на картці авто

**Епік:** [vehicle-status-flow](../vehicle-status-flow.md) · **Фаза 2** · **Залежності:** VSF-8, VSF-9 (паралельно з VSF-12)

## Мета

Відображати попередження про незакриті питання (пропущені документи/дані) для авто.

## Обсяг

- Блок алертів на `VehicleCardPage` (Ant Design `Alert` type="warning" для всіх — алерти лише інформативні, нічого не блокують).
- Іконка-індикатор алертів у списку авто.
- Фільтр «З алертами» у списку (через `hasAlerts`).

## Критерії приймання

- Алерти відображаються відповідно до стану авто; можна фільтрувати авто з алертами.
- Жодних блокувань дій на основі алертів.

## Релевантні файли

- [`apps/client/src/pages/vehicles/VehicleCardPage.tsx`](../../../apps/client/src/pages/vehicles/VehicleCardPage.tsx)
- [`apps/client/src/pages/vehicles/VehiclesListPage.tsx`](../../../apps/client/src/pages/vehicles/VehiclesListPage.tsx)
