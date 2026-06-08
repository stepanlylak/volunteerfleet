---
id: ORG-11
epic: organizations-multitenancy
phase: 2
type: feat
status: todo
depends_on: [ORG-6, ORG-10]
parallelizable: false
branch:
pr:
---

# ORG-11 — Публічні сторінки `/public/:orgId/*`

**Епік:** [organizations-multitenancy](../organizations-multitenancy.md) · **Фаза 2** · **Залежності:**
ORG-6, ORG-10

## Мета

Публічний неймспейс із префіксом org, без slug (розд. 4/9 епіку).

## Обсяг

- Додати сегмент `:orgId` у публічні роути та лукапи (бекенд + фронт).
- **Публічне авто — за `vehicle_id`:** `/public/:orgId/vehicles/:vehicleId`, лукап скоуплений по org +
  `is_public`, без slug.
- Публічний funding-звіт: `/public/:orgId/reports/funding/:fundingSourceId` — лише дані вказаної org.
- Прибрати залишки slug у публічному модулі.

## Критерії приймання

- `/public/:orgId/vehicles/:vehicleId` і `/public/:orgId/reports/funding/:id` віддають дані лише цієї org.
- Slug ніде не використовується.

## Релевантні файли

- [`public.service.ts`](../../../apps/server/src/modules/public/public.service.ts), `public.controller.ts`
- Фронт: [`PublicVehiclePage.tsx`](../../../apps/client/src/pages/public/PublicVehiclePage.tsx), [`PublicFundingReportPage.tsx`](../../../apps/client/src/pages/public/PublicFundingReportPage.tsx), [`router.tsx`](../../../apps/client/src/router.tsx)
