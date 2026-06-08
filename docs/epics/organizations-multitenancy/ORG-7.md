---
id: ORG-7
epic: organizations-multitenancy
phase: 2
type: feat
status: ready
depends_on: [ORG-6]
parallelizable: true
branch:
pr:
---

# ORG-7 — Скоуп vehicles (+ photos, status history)

**Епік:** [organizations-multitenancy](../organizations-multitenancy.md) · **Фаза 2** · **Залежності:** ORG-6
(паралельно з ORG-8/9/10)

## Мета

Ізолювати авто та дочірні сутності за активною організацією.

## Обсяг

- Org-фільтр через `orgScope` у `list/findById/update/softDelete/restore/getStatusHistory`.
- Проставляння `organization_id` на create (і на дочірні `vehicle_photos`/`vehicle_status_history` від
  батьківського авто).
- by-id поза активною org → 404.
- **Прибрати логіку `public_slug`** (генерація/перевірка унікальності в `update`).

## Критерії приймання

- Член org A не отримує/не змінює авто org B (тест на 404).
- Фото й історія статусів скоуплені; жодних згадок `public_slug`.

## Інваріанти

1–5 (розд. 7 епіку).

## Релевантні файли

- [`vehicles.service.ts`](../../../apps/server/src/modules/vehicles/vehicles.service.ts), [`vehicles.controller.ts`](../../../apps/server/src/modules/vehicles/vehicles.controller.ts)
- [`vehicle-photos.service.ts`](../../../apps/server/src/modules/vehicles/vehicle-photos.service.ts)
