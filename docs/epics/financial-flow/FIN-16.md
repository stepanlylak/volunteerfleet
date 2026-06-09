---
id: FIN-16
epic: financial-flow
phase: 3
type: test
status: todo
depends_on: [FIN-9, FIN-14, FIN-15]
parallelizable: true
branch: test/fin-16-e2e-and-docs
pr:
---

# FIN-16 — Наскрізні тести і документація

**Епік:** [financial-flow](../financial-flow.md) · **Фаза 3** · **Залежності:** FIN-9, FIN-14, FIN-15

## Мета

Перевірити головний бізнес-сценарій і синхронізувати технічні docs з реалізацією.

## Обсяг

- E2E/integration сценарій: `expense -3000 → three donations (+1000/+500/+1500) → balanceUahMinor = 0`; перевірити, що суми зберігаються/повертаються у мінорних одиницях.
- Обов'язкові vehicle/category; вибірка donations за org + donor і групування за п'ятьма авто.
- Org isolation; mixed currencies (USD/EUR/UAH з різними курсами); soft delete не входить у summary; docs preview (inline/attachment).
- Оновити `database.md`, `api.md`, `currency.md`, `files.md`, `frontend.md`, `architecture-decisions.md`.

## Критерії приймання

- Основний сценарій `-3000 + 1000 + 500 + 1500 = 0` зелений у CI.
- Жоден актуальний doc не описує funding source як обов'язкове поле expense.

## Релевантні файли

- `apps/server/test/` (інтеграційні/e2e сценарії)
- `apps/client/src/**/*.spec.tsx` (де релевантно)
- [`docs/database.md`](../../database.md), [`api.md`](../../api.md), [`currency.md`](../../currency.md), [`files.md`](../../files.md), [`frontend.md`](../../frontend.md), [`architecture-decisions.md`](../../architecture-decisions.md)
