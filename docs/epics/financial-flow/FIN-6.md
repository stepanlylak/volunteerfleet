---
id: FIN-6
epic: financial-flow
phase: 1
type: feat
status: ready
depends_on: [FIN-5]
parallelizable: false
branch: feat/fin-6-donations-crud
pr:
---

# FIN-6 — Donations CRUD

**Епік:** [financial-flow](../financial-flow.md) · **Фаза 1** · **Залежності:** FIN-5

## Мета

Створювати і редагувати донати з inline-вибором донора, обов'язковим авто і коректним курсом.

## Обсяг

- `DonationsModule` / Controller / Service: CRUD за розд. 7.1 (`GET/POST/PATCH/DELETE/restore`), ролі розд. 10.
- `DonationCreate` — XOR `donorId` / `newDonorName`; якщо `donorId` ще не приєднаний — зв'язок створюється у **тій самій транзакції**, що й донат.
- `vehicleId` обов'язковий, авто має належати active org (інакше `404`); `categoryId` (якщо є) — валідна активна `financial_categories`.
- Rate resolution: UAH → `rate = 1`, `rateSource = default`; інша валюта без `rate` → `ExchangeRatesService`; PATCH **не** перераховує курс ([ADR-010](../../architecture-decisions.md)).
- Soft delete / restore; filters `donorId`, `vehicleId`, `categoryId`, `dateFrom`, `dateTo`, `currency`.

## Критерії приймання

- Обидва donor flows (existing/new/exact-ID) працюють транзакційно; org isolation і ролі покриті тестами.
- UAH → `rate = 1`; історичний курс не змінюється при PATCH; чужий `vehicleId` → 404.

## Інваріанти

`organization_id` з контексту; signed amount не приймається з body; same-org для vehicle/donor/category (розд. 10).

## Релевантні файли

- `apps/server/src/modules/donations/*` (новий модуль)
- [`apps/server/src/modules/exchange-rates/exchange-rates.service.ts`](../../../apps/server/src/modules/exchange-rates/exchange-rates.service.ts)
- [`apps/server/src/common/utils/tenant.utils.ts`](../../../apps/server/src/common/utils/tenant.utils.ts)
