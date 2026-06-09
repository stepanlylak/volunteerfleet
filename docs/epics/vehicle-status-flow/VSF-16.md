---
id: VSF-16
epic: vehicle-status-flow
phase: 1
type: feat
status: done
depends_on: [VSF-6]
parallelizable: true
branch: feat/vsf-15-16-status-history
pr:
---

# VSF-16 — Редагування даних переходу

**Епік:** [vehicle-status-flow](../vehicle-status-flow.md) · **Фаза 1** · **Залежності:** VSF-6

## Мета

Дозволити доповнювати/виправляти дані існуючого переходу без зміни статусного флову.

## Обсяг

- Ендпоінт `PATCH /vehicles/:id/status-history/:historyId`.
- Body — strict discriminated union за immutable `transitionStatus`, який має збігатися з фактичним `new_status` запису.
- Редагування дозволених полів, документів (FK), нотатки й `transitionDate`; `old_status`/`new_status`/`changed_by`/системні timestamps не редагуються.
- Перевірки: хронологія сусідніх записів (дата не раніше попереднього і не пізніше наступного), document type/ownership/soft-delete, `orgScope`.
- Доступ `@OrgRoles(coordinator, volunteer)`; транзакція з блокуванням авто.
- Інтеграційні тести.

## Критерії приймання

- Дані переходу редагуються без зміни `old_status/new_status`; поля іншого статусу відхиляються.
- Хронологію не можна зламати; документи іншого авто/org або видалені — відхиляються.

## Інваріанти

Org-скоуп; 404 на чужу org; конкурентна безпека.

## Релевантні файли

- `apps/server/src/modules/vehicles/vehicle-transition.service.ts`, [`vehicles.controller.ts`](../../../apps/server/src/modules/vehicles/vehicles.controller.ts)
- [`packages/shared/src/schemas/vehicle.ts`](../../../packages/shared/src/schemas/vehicle.ts) (status history edit schema)
