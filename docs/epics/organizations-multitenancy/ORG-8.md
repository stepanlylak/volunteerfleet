---
id: ORG-8
epic: organizations-multitenancy
phase: 2
type: feat
status: ready
depends_on: [ORG-6]
parallelizable: true
branch:
pr:
---

# ORG-8 — Скоуп expenses + same-org валідація

**Епік:** [organizations-multitenancy](../organizations-multitenancy.md) · **Фаза 2** · **Залежності:** ORG-6
(паралельно з ORG-7/9/10)

## Мета

Ізолювати витрати за активною організацією й не дати прив'язати їх до чужого авто.

## Обсяг

- Org-фільтр через `orgScope` у всіх запитах списку/by-id/update/delete/restore.
- Проставляння `organization_id` на create.
- На create/update — same-org валідація: якщо є `vehicle_id`, авто мусить належати активній org.
- by-id поза активною org → 404.

## Критерії приймання

- Витрату не можна прив'язати до авто іншої org.
- Крос-org доступ до витрати → 404.

## Інваріанти

1–5 (особливо 4 — same-org для `vehicle_id`).

## Релевантні файли

- [`expenses.service.ts`](../../../apps/server/src/modules/expenses/expenses.service.ts), [`expenses.controller.ts`](../../../apps/server/src/modules/expenses/expenses.controller.ts)
