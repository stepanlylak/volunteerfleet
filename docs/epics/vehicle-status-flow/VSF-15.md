---
id: VSF-15
epic: vehicle-status-flow
phase: 1
type: feat
status: done
depends_on: [VSF-6]
parallelizable: true
branch: feat/vsf-15-16-status-history
pr:
---

# VSF-15 — Видалення останнього статусу (Rollback, Backend)

**Епік:** [vehicle-status-flow](../vehicle-status-flow.md) · **Фаза 1** · **Залежності:** VSF-6

## Мета

Дозволити виправляти помилкові переходи (включно з помилковим `lost`) через відкат останнього запису історії.

## Обсяг

- Ендпоінт `DELETE /vehicles/:id/status-history/last`.
- Доступ лише `@OrgRoles(coordinator)` (не `volunteer`).
- Обов'язковий `expectedLastHistoryId`; якщо з'явився новіший перехід — нічого не видаляє, `409`.
- Логіка: у транзакції блокує авто (`SELECT ... FOR UPDATE` / CAS), видаляє останній запис історії, повертає `vehicles.status` до `old_status` видаленого запису.
- Не можна видалити єдиний (початковий) статус `new`.
- Якщо відкочується `→ paid` — `is_local_purchase` зникає разом із записом (окремої синхронізації `vehicles` не треба). Прикріплені документи не видаляються автоматично.

## Критерії приймання

- Останній статус видаляється; статус авто оновлюється коректно; вихід з `lost` можливий лише через видалення запису.
- Видалення `new` заборонене; паралельний transition/rollback не пошкоджує історію (409).

## Інваріанти

Org-скоуп; 404 на чужу org; конкурентна безпека (розд. 3 п.11 епіку).

## Релевантні файли

- `apps/server/src/modules/vehicles/vehicle-transition.service.ts`, [`vehicles.controller.ts`](../../../apps/server/src/modules/vehicles/vehicles.controller.ts)
- [`apps/server/src/db/schema/vehicle-status-history.ts`](../../../apps/server/src/db/schema/vehicle-status-history.ts)
