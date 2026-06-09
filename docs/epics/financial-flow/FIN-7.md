---
id: FIN-7
epic: financial-flow
phase: 1
type: feat
status: done
depends_on: [FIN-4]
parallelizable: true
branch: feat/fin-phase-1
pr:
---

# FIN-7 — Expense flow без funding source

**Епік:** [financial-flow](../financial-flow.md) · **Фаза 1** · **Залежності:** FIN-4 (паралельно з FIN-5/FIN-6)

## Мета

Спростити витрату: прибрати джерело фінансування і зробити авто обов'язковим.

## Обсяг

- Оновити expense service / controller / contracts / tests: create/update не приймає `fundingSourceId`; response не повертає `fundingSource`; list не фільтрує за funding source.
- `vehicleId` стає **обов'язковим**; авто має належати active org (інакше `404`).
- `category_id` посилається на перейменовану `financial_categories`.
- Суми вже у мінорних одиницях (`amountMinor`) після [FIN-17](FIN-17.md) — expense flow лишається в цих одиницях.
- Оновити reports mappings, де expense посилався на funding source.

## Критерії приймання

- Create/update/list працюють без funding source і з обов'язковим `vehicleId`.
- Старий request field `fundingSourceId` відхиляється strict schema; створення витрати не залежить від донорів/донатів.

## Інваріанти

`organization_id` з контексту; `404` на чужу org; same-org для vehicle/category (розд. 10).

## Релевантні файли

- `apps/server/src/modules/expenses/*`
- [`packages/shared/src/schemas/expense.ts`](../../../packages/shared/src/schemas/expense.ts)
