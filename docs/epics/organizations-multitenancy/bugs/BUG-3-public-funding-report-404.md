---
id: BUG-3
epic: organizations-multitenancy
type: bug
status: todo
severity: high
found_in: [ORG-11]
branch:
---

# BUG-3 — Публічний funding report завжди повертає 404

**Епік:** [organizations-multitenancy](../../organizations-multitenancy.md) · **Знайдено в:** ORG-11

## Симптом

`GET /api/v1/public/:orgId/reports/funding/:fundingSourceId` повертає 404 для будь-якого запиту, навіть коректного.

## Першопричина

```ts
// apps/server/src/modules/public/public.service.ts:67
if (report.fundingSource.organizationId !== orgId) {
  throw new NotFoundException('PUBLIC_REPORT_NOT_FOUND');
}
```

`funding_sources` — **глобальна (shared) таблиця**: за рішенням епіку (розд. 3, п. 3) вона не має колонки `organization_id`. Тому `report.fundingSource.organizationId` завжди `undefined`, умова `undefined !== orgId` завжди `true`, і ендпоінт ніколи не повертає дані.

## Продуктове питання

Потрібно уточнити, яка семантика ізоляції тут потрібна:

- **Варіант A (рекомендований):** Funding report для заданого `fundingSourceId` фільтрується лише по авто, що належать `orgId`. Звіт повертає дані виключно по цій org — навіть якщо той самий `fundingSourceId` фінансує авто в іншій org. Перевірку «404 якщо у цій org немає жодних витрат по цьому donor'у» — опційно.
- **Варіант B:** Funding reports є глобально публічними; `orgId` в URL — лише для namespace, без фільтрації. Перевірку `organizationId` прибрати повністю.

## Виправлення (варіант A)

Передати `orgId` у `getPublicFundingSourceReport` і додати фільтр по `expenses.organization_id`:

```ts
// public.service.ts
async getFundingReport(orgId, fundingSourceId, query) {
  const report = await this.reports.getPublicFundingSourceReport(fundingSourceId, orgId, query);
  if (!report) throw new NotFoundException('PUBLIC_REPORT_NOT_FOUND');
  return { ... };
}
```

```ts
// reports.service.ts — getPublicFundingSourceReport
// додати до conditions:
eq(expenses.organizationId, organizationId),
```

## Критерії приймання

- `/public/:orgId/reports/funding/:id` повертає дані (не 404) для коректного запиту.
- Витрати у звіті належать лише вказаній `orgId`.
- Невалідний `orgId` або `fundingSourceId` → 404.

## Релевантні файли

- [`apps/server/src/modules/public/public.service.ts`](../../../../apps/server/src/modules/public/public.service.ts)
- [`apps/server/src/modules/reports/reports.service.ts`](../../../../apps/server/src/modules/reports/reports.service.ts)
- [`apps/client/src/pages/public/PublicFundingReportPage.tsx`](../../../../apps/client/src/pages/public/PublicFundingReportPage.tsx)
