---
id: ORG-10
epic: organizations-multitenancy
phase: 2
type: feat
status: done
depends_on: [ORG-6]
parallelizable: true
branch: feat/org-8-expenses-scope
pr:
---

# ORG-10 — Скоуп dashboard і reports

**Епік:** [organizations-multitenancy](../organizations-multitenancy.md) · **Фаза 2** · **Залежності:** ORG-6
(паралельно з ORG-7/8/9)

## Мета

Агрегації й звіти рахують лише дані активної організації.

## Обсяг

- Org-фільтр в агрегаціях дашборда (counts авто/статусів, місячні витрати, документи).
- Org-фільтр у звітах vehicle/funding — лише дані активної org.
- Звіт по авто чужої org → 404.

## Критерії приймання

- Цифри дашборда й звітів відповідають виключно активній організації.

## Інваріанти

1–2 (скоуп агрегацій; 404 на чуже авто у звіті).

## Релевантні файли

- [`dashboard.service.ts`](../../../apps/server/src/modules/dashboard/dashboard.service.ts)
- `apps/server/src/modules/reports/reports.service.ts`, `reports.controller.ts`
