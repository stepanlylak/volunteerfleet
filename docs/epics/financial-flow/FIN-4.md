---
id: FIN-4
epic: financial-flow
phase: 0
type: feat
status: ready
depends_on: [FIN-2, FIN-3]
parallelizable: false
branch: feat/fin-phase-0
pr:
---

# FIN-4 — `financial_categories`, видалення `funding_sources` і міграція

**Епік:** [financial-flow](../financial-flow.md) · **Фаза 0** · **Залежності:** FIN-2, FIN-3

## Мета

Прибрати обов'язкове джерело фінансування, зробити категорії спільними для всіх фінансових подій і вичистити застарілу схему.

## Обсяг

- Rename `expense_categories → financial_categories` **зі збереженням UUID** і unique-індексу на `name` (розд. 6.3); `expenses.category_id → financial_categories`; `donations.category_id → financial_categories` (nullable).
- Drop `expenses.funding_source_id` + FK + `expenses_funding_source_id_idx`.
- `expenses.vehicle_id → NOT NULL`.
- Drop `funding_sources` table, `funding_source_type` enum, `fundingSourcesRelations` / `expenses.fundingSource`.
- Drop redundant price-колонки з `vehicle_status_history` (`purchase_price/currency/rate/rate_source`) — ціна купівлі живе у витратах (розд. 11).
- Seed `financial_categories`: щонайменше «Купівля авто», «Ремонт», «Логістика», «Загальні потреби»; прибрати funding-source seed.
- Стратегія розд. 12 (живих даних немає → міграції доводяться при імплементації, БД перестворюється).

> Грошові колонки (`expenses.amount → amount_minor` тощо) переводяться у мінорні одиниці окремо в [FIN-17](FIN-17.md); координувати міграції, бо обидва тікети чіпають `expenses`.

## Критерії приймання

- Expense створюється без funding source і з обов'язковим `vehicleId`.
- Runtime-згадок `fundingSource` немає; price-колонок у `vehicle_status_history` немає.
- Seed-категорії застосовано; міграція проходить на цільовому середовищі.

## Релевантні файли

- [`apps/server/src/db/schema/dictionaries.ts`](../../../apps/server/src/db/schema/dictionaries.ts), [`expenses.ts`](../../../apps/server/src/db/schema/expenses.ts), [`enums.ts`](../../../apps/server/src/db/schema/enums.ts), [`relations.ts`](../../../apps/server/src/db/schema/relations.ts)
- `apps/server/src/db/schema/vehicle-status-history.ts`
- [`apps/server/src/scripts/seed.ts`](../../../apps/server/src/scripts/seed.ts), [`seed-demo.ts`](../../../apps/server/src/scripts/seed-demo.ts)
