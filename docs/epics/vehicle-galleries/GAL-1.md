---
id: GAL-1
epic: vehicle-galleries
phase: 0
type: feat
status: done
depends_on: []
parallelizable: false
branch: feat/gal-1-shared-gallery-contracts
pr:
---

# GAL-1 — Shared-контракти галерей

**Епік:** [vehicle-galleries](../vehicle-galleries.md) · **Фаза 0** · **Залежності:** —

## Мета

Зафіксувати типи й strict Zod-контракти, на яких будуються схема, backend та frontend.

## Обсяг

- Додати `VehicleGalleryKind = main | custom` і `VehicleGalleryItemType = image`.
- Додати схеми gallery create/update/list/response, item upload metadata/update/order/move,
  set-cover і public gallery response.
- `name`: required trimmed для custom; `description` і `caption`: nullable/optional з
  нормалізацією порожнього рядка у `null`.
- `isPublic` для create custom має default false.
- Order schema приймає 1–30 унікальних UUID; окремо передбачити empty gallery без виклику reorder.
- Response містить `maxItems: 30`, `explicitCoverItemId` і `effectiveCoverItemId`.
- Додати nullable `mainGalleryCover` до vehicle list/detail response contracts.
- Нові object schemas зробити strict, щоб невідомі поля не ігнорувалися.
- Додати unit-тести схем, defaults, limits і duplicate IDs.
- Старі photo schemas поки не видаляти: cleanup виконується у GAL-11.

## Критерії приймання

- Контракти експортуються з `@volunteerfleet/shared`.
- Custom create без `isPublic` дає false.
- Порожні optional text values нормалізуються у `null`.
- Order відхиляє понад 30 items і duplicate IDs.
- `pnpm -w typecheck` та shared tests зелені.

## Релевантні файли

- `packages/shared/src/schemas/vehicle-gallery.ts` (новий)
- `packages/shared/src/schemas/vehicle.ts`
- `packages/shared/src/schemas/public.ts`
- `packages/shared/src/schemas/index.ts`
