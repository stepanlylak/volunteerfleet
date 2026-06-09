---
id: VSF-13
epic: vehicle-status-flow
phase: 3
type: test
status: todo
depends_on: [VSF-6, VSF-8, VSF-9, VSF-10, VSF-11, VSF-12, VSF-15, VSF-16, VSF-18, VSF-19, VSF-20]
parallelizable: true
branch: test/vsf-13-e2e-regression
pr:
---

# VSF-13 — Тести (наскрізна регресія)

**Епік:** [vehicle-status-flow](../vehicle-status-flow.md) · **Фаза 3** · **Залежності:** Фази 0–2 (паралельно з VSF-14)

## Мета

Додати наскрізну регресію поверх тестів, що вже входять до відповідних implementation-тікетів.

## Обсяг

- E2E-сценарії: повний флов, локальна покупка, повернення і повторна передача, цикл ремонту.
- Rollback, редагування історії, конкурентні запити, org isolation.
- Тест, що загальний `PATCH /vehicles/:id` не змінює статус.
- Алерти прив'язані до правильного `vehicle_status_history.id` (VSF-19); каунт у списку/вкладці
  збігається з кількістю алертів; фільтр `hasAlerts` працює.
- Техпаспорт без/з печаткою — два незалежні алерти, кожен закривається своїм документом (VSF-20).
- Перехід `→ in_repair` приймається без `repairNote`; спільне поле `note` доступне (VSF-18).

## Критерії приймання

- Тести зелені в CI.

## Релевантні файли

- `apps/server/test/` (інтеграційні/e2e сценарії)
- `apps/client/src/**/*.spec.tsx` (де релевантно)
