---
id: VSF-6
epic: vehicle-status-flow
phase: 1
type: feat
status: todo
depends_on: [VSF-5]
parallelizable: false
branch: feat/vsf-6-transition-endpoint
pr:
---

# VSF-6 — Ендпоінт `POST /vehicles/:id/transition`

**Епік:** [vehicle-status-flow](../vehicle-status-flow.md) · **Фаза 1** · **Залежності:** VSF-5

## Мета

Реалізувати зміну статусу з валідацією матриці переходів та збереженням даних переходу.

## Обсяг

- `VehicleTransitionService`: валідація матриці, запис у `vehicle_status_history` з додатковими полями, оновлення `vehicles.status`; `VehiclesController.transition()`.
- Zod-валідація body (strict discriminated union за `targetStatus`); `@OrgRoles(coordinator, volunteer)`; `orgScope`.
- Документи (якщо передані) належать тому ж авто, в активній org, не soft-deleted і мають правильний `document_type`.
- Обов'язковий `expectedCurrentStatus`; транзакція з row lock / compare-and-swap → конфлікт `409`.
- `paid → arrived` лише якщо запис `→ paid` має `is_local_purchase = true`.
- Ціна покупки: default/manual rate через `ExchangeRatesService` за `transition_date`; для UAH `rate = 1`; група полів — або вся, або жодного.
- Для `→ arrived` записати переданий `borderCrossingDate` у `vehicles.border_crossing_date` у тій самій транзакції.
- Для `returned → transferred` — заборона повторного використання старого підписаного акту.
- Інтеграційні тести: валідні/невалідні/паралельні переходи, локальна покупка, org isolation.

## Критерії приймання

- Неможливий перехід → 400; `lostReason` обов'язковий для `lost`; конкурентна зміна → 409.
- Перехід зберігається в історію з усіма даними; `orgScope` дотримується; два одночасні переходи не створюють розгалужену історію.

## Інваріанти

Org-скоуп у кожному запиті, 404 (не 403) на чужу org, `organization_id` з контексту, same-org для крос-зв'язків (розд. 7 org-епіку).

## Релевантні файли

- `apps/server/src/modules/vehicles/vehicle-transition.service.ts` (новий)
- [`apps/server/src/modules/vehicles/vehicles.controller.ts`](../../../apps/server/src/modules/vehicles/vehicles.controller.ts), [`vehicles.service.ts`](../../../apps/server/src/modules/vehicles/vehicles.service.ts)
- [`apps/server/src/modules/exchange-rates/exchange-rates.service.ts`](../../../apps/server/src/modules/exchange-rates/exchange-rates.service.ts)
- [`apps/server/src/common/utils/tenant.utils.ts`](../../../apps/server/src/common/utils/tenant.utils.ts)
