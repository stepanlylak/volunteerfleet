---
id: ORG-9
epic: organizations-multitenancy
phase: 2
type: feat
status: ready
depends_on: [ORG-6]
parallelizable: true
branch:
pr:
---

# ORG-9 — Скоуп documents + same-org валідація

**Епік:** [organizations-multitenancy](../organizations-multitenancy.md) · **Фаза 2** · **Залежності:** ORG-6
(паралельно з ORG-7/8/10)

## Мета

Ізолювати документи за активною організацією, включно із завантаженням файлів.

## Обсяг

- Org-фільтр через `orgScope` у запитах списку/by-id/update/delete.
- Проставляння `organization_id` на create.
- Same-org валідація: `vehicle_id`/`expense_id` мусять належати активній org.
- **Presigned-download скоуплений по org** — документ чужої org не віддається на завантаження.

## Критерії приймання

- Документ чужої org недоступний на перегляд і на завантаження файлу (404).

## Інваріанти

1–5 (особливо 1 — скоуп поширюється і на видачу файлів).

## Релевантні файли

- `apps/server/src/modules/documents/documents.service.ts`, `documents.controller.ts`
- [`apps/server/src/storage/`](../../../apps/server/src/storage/) — за потреби (presigned)
