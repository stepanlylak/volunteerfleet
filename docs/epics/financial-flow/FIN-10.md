---
id: FIN-10
epic: financial-flow
phase: 2
type: feat
status: todo
depends_on: [FIN-6, FIN-7]
parallelizable: false
branch: feat/fin-10-reusable-money-fields
pr:
---

# FIN-10 — Reusable money fields

**Епік:** [financial-flow](../financial-flow.md) · **Фаза 2** · **Залежності:** FIN-6, FIN-7 (+ [VSF-9](../vehicle-status-flow/VSF-9.md))

## Мета

Не дублювати amount/currency/rate logic між формою витрати, донату і paid-переходом VSF.

## Обсяг

- Винести спільний компонент полів суми/валюти/курсу/rateSource із VSF/expense form у reusable-компонент.
- Застосувати його у `ExpenseFormModal` і (далі) `DonationFormModal`.
- Поведінка: auto-rate через `ExchangeRatesService` за датою, manual override (`rateSource = manual`), UAH → `rate = 1` (заблокований).
- Введення/відображення — у major-одиницях, але назовні компонент віддає `amountMinor` (integer ×100); парсинг/форматування лише на краях (розд. 3 п.17).

## Критерії приймання

- Auto-rate, manual rate і UAH=1 поводяться однаково в обох формах.
- Жодного дублювання rate-логіки між формами.

## Релевантні файли

- `apps/client/src/components/MoneyFields.tsx` (новий, або винесений із existing)
- [`apps/client/src/modals/ExpenseFormModal.tsx`](../../../apps/client/src/modals/ExpenseFormModal.tsx)
- [`apps/client/src/hooks/useExchangeRate.ts`](../../../apps/client/src/hooks/useExchangeRate.ts)
