---
id: FIN-9
epic: financial-flow
phase: 1
type: chore
status: done
depends_on: [FIN-8]
parallelizable: false
branch: feat/fin-phase-1
pr:
---

# FIN-9 — Cleanup старих reports + reporting-ready queries

**Епік:** [financial-flow](../financial-flow.md) · **Фаза 1** · **Залежності:** FIN-8

## Мета

Прибрати застарілі funding-source звіти і лишити стабільну основу для майбутнього donor-reporting епіку.

## Обсяг

- Видалити `GET /reports/funding-source/:id` і `GET /public/:orgId/reports/funding/:id` (+ shared report schemas, public routes, FE report page).
- Перевірити list filters і індекси `(organization_id, donor_id, vehicle_id)` / `(donor_id, organization_id, vehicle_id)` — зріз «донор у фонді за автомобілями» без full scan.
- Оновити dashboard лише базовими finance KPI (витрати / донати / баланс) — у мінорних одиницях, агрегація в SQL.

## Критерії приймання

- Старих funding routes немає (server + public + FE).
- Donation rows можна вибрати за org + donor і згрупувати за `vehicle` без зміни схеми або повного table scan.

## Інваріанти

`orgScope` на dashboard/reports запитах; жодних state-changing GET (розд. 10).

## Релевантні файли

- `apps/server/src/modules/reports/*`, `modules/public/*`, `modules/dashboard/*`
- [`packages/shared/src/schemas/report.ts`](../../../packages/shared/src/schemas/report.ts)
- `apps/client/src/pages/FundingSourceReportPage.tsx` (видалити), `pages/ReportsIndexPage.tsx`
