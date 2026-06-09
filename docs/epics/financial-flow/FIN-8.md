---
id: FIN-8
epic: financial-flow
phase: 1
type: feat
status: done
depends_on: [FIN-6, FIN-7]
parallelizable: false
branch: feat/fin-phase-1
pr:
---

# FIN-8 — Unified financial journal і balance

**Епік:** [financial-flow](../financial-flow.md) · **Фаза 1** · **Залежності:** FIN-6, FIN-7

## Мета

Один read-only endpoint для таблиці фінансових подій і KPI балансу.

## Обсяг

- `GET /api/v1/financial-entries` (розд. 7.3): SQL `UNION ALL` нормалізованих **active** expenses і donations.
- Спільні sort / pagination застосовуються **після** union; stable tie-breaker `createdAt DESC, id DESC`; сортування за `amount` — за UAH-нормалізованим `amountUahMinor`.
- Summary окремим aggregate query з **тими самими** фільтрами: `expensesUahMinor`, `donationsUahMinor`, `balanceUahMinor` + `byCurrency` breakdown (розд. 4).
- Signed arithmetic у **мінорних одиницях**: expense → `-amountMinor`, donation → `+amountMinor`; `signedAmountUahMinor = round(signedAmountMinor * rate)` (per-row); агрегати — `sum(round(amount_minor * rate))` у SQL. Усі грошові поля response із суфіксом `Minor`.
- `documentCount` для expense rows рахує лише активні документи (`deleted_at IS NULL`).
- Фільтри: `type`, `vehicleId`, `categoryId`, `donorId` (виключає expense branch), `dateFrom/dateTo`, `currency`.

## Критерії приймання

- Пагінація відбувається після union; summary відповідає тим самим фільтрам.
- Усі грошові значення — цілі мінорні; агрегація в SQL (без JS-float); signed arithmetic і breakdown покриті unit/integration tests; `documentCount` не рахує видалені.

## Інваріанти

Обидві гілки union завжди фільтруються за active org; signed amount визначає сервер; soft-deleted не входять у summary (розд. 10).

## Релевантні файли

- `apps/server/src/modules/financial-entries/*` (новий) або розширення `modules/expenses`
- `packages/shared/src/schemas/financial-entry.ts`
- [`apps/server/src/common/utils/tenant.utils.ts`](../../../apps/server/src/common/utils/tenant.utils.ts)
