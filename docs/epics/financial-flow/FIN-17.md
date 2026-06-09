---
id: FIN-17
epic: financial-flow
phase: 0
type: refactor
status: ready
depends_on: [FIN-1]
parallelizable: false
branch: feat/fin-phase-0
pr:
---

# FIN-17 — Гроші як цілі мінорні одиниці (копійки/центи)

**Епік:** [financial-flow](../financial-flow.md) · **Фаза 0** · **Залежності:** FIN-1

## Мета

Перевести наявну роботу з грошима на **integer мінорні одиниці** (×100) — основа, на якій будуються всі фінансові розрахунки епіку (розд. 3 п.17, 4.1). Без прод-даних → колонки змінюються, БД перестворюється.

## Обсяг

- **БД:** `expenses.amount numeric(14,2)` → `amount_minor bigint`; `vehicles.public_collected_amount_uah` / `public_goal_amount_uah` → `bigint` мінорні; `rate` лишається `numeric(14,6)`.
- **Сервер:** expenses service приймає/віддає мінорні (без `toFixed(2)`); dashboard `sum(amount_minor * rate)` з `round`; **прибрати JS-float** `roundMoney(... + EPSILON)` у reports.service — рахувати цілими (`Math.round(amount_minor * rate)`, `sum` цілих); public.service passthrough.
- **Frontend:** `formatCurrency` / `formatNumber` ділять мінорні на 100 для відображення; форми множать на 100 на сабміті, ділять на 100 при завантаженні — конвертація **лише на краях**.
- **Seed/fixtures:** суми × 100.
- **Тести:** оновити очікувані значення; додати перевірку відсутності off-by-100 (round після множення на `rate`).

## Критерії приймання

- Усі грошові колонки/поля — цілі мінорні одиниці; `rate` незмінний; жодної JS-float грошової математики.
- Наявні фічі (витрати, dashboard, reports, public) зелені в нових одиницях; конвертація UAH = `round(amount_minor * rate)` per-row.

## Інваріанти

Грошова арифметика — цілими; major-одиниці існують лише на UI-краях (введення/відображення).

## Релевантні файли

- [`apps/server/src/db/schema/expenses.ts`](../../../apps/server/src/db/schema/expenses.ts), [`vehicles.ts`](../../../apps/server/src/db/schema/vehicles.ts)
- [`apps/server/src/modules/expenses/expenses.service.ts`](../../../apps/server/src/modules/expenses/expenses.service.ts), [`dashboard/dashboard.service.ts`](../../../apps/server/src/modules/dashboard/dashboard.service.ts), [`reports/reports.service.ts`](../../../apps/server/src/modules/reports/reports.service.ts), [`public/public.service.ts`](../../../apps/server/src/modules/public/public.service.ts)
- [`packages/shared/src/schemas/expense.ts`](../../../packages/shared/src/schemas/expense.ts)
- [`apps/client/src/utils/format.ts`](../../../apps/client/src/utils/format.ts), [`modals/ExpenseFormModal.tsx`](../../../apps/client/src/modals/ExpenseFormModal.tsx)
- [`apps/server/src/scripts/seed.ts`](../../../apps/server/src/scripts/seed.ts), [`seed-demo.ts`](../../../apps/server/src/scripts/seed-demo.ts)
