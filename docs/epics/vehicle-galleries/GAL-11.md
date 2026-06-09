---
id: GAL-11
epic: vehicle-galleries
phase: 2
type: refactor
status: todo
depends_on: [GAL-4, GAL-9, GAL-10]
parallelizable: false
branch:
pr:
---

# GAL-11 — Видалення legacy photo flow і cleanup

**Епік:** [vehicle-galleries](../vehicle-galleries.md) · **Фаза 2** · **Залежності:** GAL-4, GAL-9, GAL-10

## Мета

Прибрати старі photo endpoints, schemas, hooks та UI після повного переходу на galleries.

## Обсяг

- Видалити `/vehicles/:id/photos*` і `/public/vehicle-photos/:id/download`.
- Видалити `VehiclePhotosService`, старі shared photo schemas/types та exports.
- Видалити таблицю/Drizzle schema `vehicle_photos`, її relations, indexes і остаточно оновити
  greenfield-міграції та snapshots; backfill не додавати.
- Видалити `useVehiclePhotos`, photo mutations і legacy API methods.
- Прибрати photo field, upload state, limit 10 та related error messages з `VehicleFormModal`.
- Прибрати старий `VehiclePhotoGallery` з картки авто.
- Видалити `FileAttachmentField` kind `photo`, якщо він більше ніде не використовується; не
  рефакторити спільний file component понад необхідне.
- Видалити згадки `vehicle_photos`, `maxPhotos: 10`, старі object key paths і stale tests/docs.
- Перевірити OpenAPI та generated/shared exports на відсутність legacy contract.
- Не видаляти MinIO objects: живих даних немає, а physical cleanup поза scope.

## Критерії приймання

- `rg` не знаходить runtime-згадок legacy endpoints/table/types, крім історичного тексту за потреби.
- Vehicle form не містить фото.
- Усі photo flows працюють лише через galleries/items.
- Client/server build, lint і typecheck зелені.

## Релевантні файли

- `apps/server/src/modules/vehicles/vehicle-photos.service.ts`
- `apps/server/src/modules/vehicles/vehicles.controller.ts`
- `packages/shared/src/schemas/vehicle-photo.ts`
- `apps/client/src/modals/VehicleFormModal.tsx`
- `apps/client/src/api/vehicles.api.ts`
- `apps/client/src/hooks/useVehicles.ts`
