---
id: VSF-11
epic: vehicle-status-flow
phase: 2
type: feat
status: done
depends_on: [VSF-9, VSF-16]
parallelizable: false
branch: feat/vsf-11-12-history-timeline-filters
pr:
---

# VSF-11 — Покращена історія статусів

**Епік:** [vehicle-status-flow](../vehicle-status-flow.md) · **Фаза 2** · **Залежності:** VSF-9, VSF-16

## Мета

Деталізований таймлайн історії з даними кожного переходу та можливістю редагування.

## Обсяг

- Рефактор компонента історії: таймлайн (Ant Design `Timeline`).
- Для кожного переходу — додаткові дані: ціна, документи (клікабельні посилання), нотатки, дата.
- Кольори за статусом із `VEHICLE_STATUS_CONFIG`.
- Дія редагування відкриває status-specific форму та викликає endpoint з [VSF-16](VSF-16.md).

## Критерії приймання

- Історія показує всі дані переходу; документи клікабельні.
- `coordinator` і `volunteer` можуть доповнити дозволені дані без зміни статусів.

## Релевантні файли

- [`apps/client/src/pages/vehicles/VehicleCardPage.tsx`](../../../apps/client/src/pages/vehicles/VehicleCardPage.tsx) (секція історії)
- `apps/client/src/components/` (компонент таймлайну історії)
