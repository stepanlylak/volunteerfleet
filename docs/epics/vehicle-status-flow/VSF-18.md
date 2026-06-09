---
id: VSF-18
epic: vehicle-status-flow
phase: 2
type: chore
status: done
depends_on: [VSF-9, VSF-11, VSF-16]
parallelizable: true
branch: chore/vsf-18-remove-repair-note
pr:
---

# VSF-18 — Видалення поля `repairNote` (дублює спільну нотатку)

**Епік:** [vehicle-status-flow](../vehicle-status-flow.md) · **Фаза 2** · **Залежності:** VSF-9, VSF-11, VSF-16

## Мета

Прибрати специфічне поле переходу `repairNote` («Примітка до ремонту»). Кожен перехід уже має
спільне необов'язкове поле `note`, яке повністю покриває цей кейс — окреме поле для `→ in_repair`
надлишкове. Після видалення перехід `→ in_repair` не має жодних специфічних полів (лише спільні
`note` + `transitionDate`), що є очікуваним.

## Обсяг

- **БД:** прибрати колонку `repair_note` з `vehicle_status_history` **редагуванням існуючої
  початкової міграції** `apps/server/drizzle/0000_wealthy_catseye.sql` (а не новою drop-міграцією).
  БД перестворюється з нуля без даних — окрема data-міграція не потрібна. За потреби міграції можна
  заодно консолідувати/розбити по сутностях.
- **Schema (Drizzle):** прибрати `repairNote` з [`vehicle-status-history.ts`](../../../apps/server/src/db/schema/vehicle-status-history.ts).
- **Shared (Zod):** прибрати `repairNote` з transition-схеми `→ in_repair` та edit-схеми у
  `packages/shared/src/schemas/vehicle-status.ts`; прибрати з `VehicleResponse` у
  `packages/shared/src/schemas/vehicle.ts`.
- **Сервер:** прибрати запис/мапінг `repairNote` у `vehicle-transition.service.ts` і `toResponse`
  у `vehicles.service.ts`.
- **Клієнт:** прибрати поле «Примітка до ремонту» зі `StatusTransitionModal.tsx` (case `in_repair`)
  та `StatusHistoryEditModal.tsx`; прибрати відображення `repairNote` у `VehicleCardPage.tsx`.
- **Док:** оновити `vehicle-status-flow.md` — таблиця даних переходів (рядок `→ in_repair`),
  перелік колонок (розд. 6), поля редагування, згадки про повторний `in_repair`.

## Критерії приймання

- Колонки `repair_note` немає; transition/edit для `→ in_repair` приймає лише спільні поля.
- Спільне поле «Примітка» доступне для `→ in_repair` у модалці переходу й при редагуванні.
- Усі тести зелені; типи `VehicleResponse`/transition не містять `repairNote`.

## Релевантні файли

- `apps/server/drizzle/0000_wealthy_catseye.sql` (прибрати колонку; БД перестворюється з нуля)
- [`apps/server/src/db/schema/vehicle-status-history.ts`](../../../apps/server/src/db/schema/vehicle-status-history.ts)
- [`packages/shared/src/schemas/vehicle-status.ts`](../../../packages/shared/src/schemas/vehicle-status.ts), [`vehicle.ts`](../../../packages/shared/src/schemas/vehicle.ts)
- `apps/server/src/modules/vehicles/vehicle-transition.service.ts`, [`vehicles.service.ts`](../../../apps/server/src/modules/vehicles/vehicles.service.ts)
- [`apps/client/src/modals/StatusTransitionModal.tsx`](../../../apps/client/src/modals/StatusTransitionModal.tsx), [`StatusHistoryEditModal.tsx`](../../../apps/client/src/modals/StatusHistoryEditModal.tsx)
- [`apps/client/src/pages/vehicles/VehicleCardPage.tsx`](../../../apps/client/src/pages/vehicles/VehicleCardPage.tsx)
