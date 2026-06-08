---
id: VSF-12
epic: vehicle-status-flow
phase: 2
type: feat
status: todo
depends_on: [VSF-9]
parallelizable: true
branch: feat/vsf-12-filters-and-dictionaries
pr:
---

# VSF-12 — Оновлення фільтрів, форм і довідників

**Епік:** [vehicle-status-flow](../vehicle-status-flow.md) · **Фаза 2** · **Залежності:** VSF-9 (паралельно з VSF-10)

## Мета

Прибрати статуси з довідників і перевести всіх FE-споживачів статусу на enum + `VEHICLE_STATUS_CONFIG`.

## Обсяг

- Видалити секцію статусів зі сторінки довідників.
- Фільтр статусу у списку авто — чекбокси з `VEHICLE_STATUS_CONFIG`.
- Форма створення авто — без `statusId`; поле «Дата перетину кордону» → «Початкова дата» (прив'язка до `startDate`).
- Форма редагування авто — без зміни статусу.
- Затюнити дефолт дати у `ExpenseFormModal`: `остання витрата → borderCrossingDate → startDate → сьогодні`.
- Перевести на enum + config решту FE-споживачів: `VehicleReportPage.tsx`, `PublicVehiclePage.tsx`, `DashboardPage.tsx` (групи з `VEHICLE_STATUS_DASHBOARD_GROUP`).

## Критерії приймання

- Довідники не містять статусів; фільтри працюють з enum; форми не показують поле статусу.
- Звіт і публічна сторінка показують статус з enum-конфігу; дефолт дати витрати коректний.

## Релевантні файли

- [`apps/client/src/pages/admin/DictionariesPage.tsx`](../../../apps/client/src/pages/admin/DictionariesPage.tsx)
- [`apps/client/src/pages/vehicles/VehiclesListPage.tsx`](../../../apps/client/src/pages/vehicles/VehiclesListPage.tsx), [`VehicleFormModal.tsx`](../../../apps/client/src/modals/VehicleFormModal.tsx)
- [`apps/client/src/modals/ExpenseFormModal.tsx`](../../../apps/client/src/modals/ExpenseFormModal.tsx)
- [`apps/client/src/pages/VehicleReportPage.tsx`](../../../apps/client/src/pages/VehicleReportPage.tsx), [`public/PublicVehiclePage.tsx`](../../../apps/client/src/pages/public/PublicVehiclePage.tsx), [`dashboard/DashboardPage.tsx`](../../../apps/client/src/pages/dashboard/DashboardPage.tsx)
