---
id: VSF-20
epic: vehicle-status-flow
phase: 2
type: feat
status: done
depends_on: [VSF-9, VSF-11, VSF-16]
parallelizable: true
branch: feat/vsf-20-split-registration-doc
pr:
---

# VSF-20 — Розщеплення техпаспорта: без печатки (paid) / з печаткою (arrived)

**Епік:** [vehicle-status-flow](../vehicle-status-flow.md) · **Фаза 2** · **Залежності:** VSF-9, VSF-11, VSF-16

## Мета

Зараз одне поле `registrationDocId` (техпаспорт) приймається і на `→ paid`, і на `→ arrived`, що
неоднозначно. Технічно це два різні документи: техпаспорт **без** митної печатки (на етапі покупки)
і **з** митною печаткою (після прибуття/розмитнення). Розщепити на два окремі поля з окремими
алертами — за аналогією з митною декларацією (`customsDeclarationDocId` / `stampedCustomsDeclarationDocId`).

## Модель

| Перехід     | Поле                                      | Документ                          |
| ----------- | ----------------------------------------- | --------------------------------- |
| `→ paid`    | `registrationDocId` (без змін за змістом) | техпаспорт **без** митної печатки |
| `→ arrived` | `stampedRegistrationDocId` (нове)         | техпаспорт **з** митною печаткою  |

На `→ arrived` поле `registrationDocId` більше **не приймається** — замість нього
`stampedRegistrationDocId`.

## Алерти

- `missing_registration_doc` — техпаспорт без печатки відсутній; статуси
  `paid/in_transit/arrived/in_repair/ready/transferred/returned` (як зараз).
- `missing_stamped_registration_doc` (**новий**) — техпаспорт з печаткою відсутній; статуси
  `arrived/in_repair/ready/transferred/returned` (аналогічно `missing_stamped_customs_declaration`).

## Обсяг

- **БД:** додати колонку `stamped_registration_doc_id` (uuid, FK `documents`, `onDelete: restrict`,
  null) на `vehicle_status_history`. Редагувати початкову міграцію `0000_wealthy_catseye.sql`
  (БД перестворюється з нуля, без data-міграцій).
- **Schema (Drizzle):** нова колонка в [`vehicle-status-history.ts`](../../../apps/server/src/db/schema/vehicle-status-history.ts).
- **Shared (Zod):** `→ arrived` transition/edit використовує `stampedRegistrationDocId` замість
  `registrationDocId`; додати поле у `VehicleResponse` (`packages/shared/src/schemas/vehicle.ts`);
  додати тип `missing_stamped_registration_doc` у `VEHICLE_ALERT_TYPES` + `VEHICLE_ALERT_CONFIG`
  (UA-текст, напр. «Відсутній техпаспорт з печаткою митниці»; для `missing_registration_doc`
  уточнити текст на «без печатки митниці»).
- **Backend (View):** додати UNION-предикат для `missing_stamped_registration_doc` у
  `vehicle_alerts_view`; `missing_registration_doc` лишається на `registration_doc_id`. Редагувати
  міграцію `0001_vehicle_alerts_view.sql`.
- **Backend (service):** запис/мапінг `stampedRegistrationDocId` у transition/edit service і
  `toResponse`.
- **Клієнт:** у `StatusTransitionModal.tsx` для `arrived` поле «Техпаспорт з печаткою митниці»
  (замість поточного техпаспорта), для `paid` — «Техпаспорт без печатки митниці»; те саме в
  `StatusHistoryEditModal.tsx`; відображення в історії `VehicleCardPage.tsx`.
- **Док:** оновити таблицю даних переходів і таблицю алертів у `vehicle-status-flow.md`.

## Критерії приймання

- `→ paid` приймає лише техпаспорт без печатки, `→ arrived` — лише з печаткою; перехресні поля
  відхиляються валідацією.
- Два незалежні алерти; кожен зникає при прикріпленні свого документа.
- Тести View оновлені (обидва типи, цикли, soft-delete, org isolation).

## Інваріанти

Org-скоуп; document type/ownership/soft-delete перевірки; конкурентна безпека (як у VSF-16).

## Релевантні файли

- `apps/server/drizzle/0000_wealthy_catseye.sql`, `0001_vehicle_alerts_view.sql`
- [`apps/server/src/db/schema/vehicle-status-history.ts`](../../../apps/server/src/db/schema/vehicle-status-history.ts), [`vehicle-alerts-view.ts`](../../../apps/server/src/db/schema/vehicle-alerts-view.ts)
- [`packages/shared/src/schemas/vehicle-status.ts`](../../../packages/shared/src/schemas/vehicle-status.ts), [`vehicle.ts`](../../../packages/shared/src/schemas/vehicle.ts)
- `apps/server/src/modules/vehicles/vehicle-transition.service.ts`, [`vehicles.service.ts`](../../../apps/server/src/modules/vehicles/vehicles.service.ts)
- [`apps/client/src/modals/StatusTransitionModal.tsx`](../../../apps/client/src/modals/StatusTransitionModal.tsx), [`StatusHistoryEditModal.tsx`](../../../apps/client/src/modals/StatusHistoryEditModal.tsx)
- [`apps/client/src/pages/vehicles/VehicleCardPage.tsx`](../../../apps/client/src/pages/vehicles/VehicleCardPage.tsx)
