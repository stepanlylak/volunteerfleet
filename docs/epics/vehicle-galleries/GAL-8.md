---
id: GAL-8
epic: vehicle-galleries
phase: 2
type: feat
status: todo
depends_on: [GAL-3, GAL-4]
parallelizable: true
branch:
pr:
---

# GAL-8 — Галереї на картці авто та базова модалка

**Епік:** [vehicle-galleries](../vehicle-galleries.md) · **Фаза 2** · **Залежності:** GAL-3, GAL-4

## Мета

Показати gallery model на картці автомобіля та дати базове керування metadata й upload.

## Обсяг

- Додати API client/hooks/query keys для gallery list, create, update, delete та upload.
- Замінити плоский `VehiclePhotoGallery` на секцію «Галереї».
- Main показується першою з українською назвою «Основна».
- Custom cards показують name, optional description, public/private status, count та cover preview.
- Додати create/edit gallery modal:
  - custom: name, description, public switch;
  - main: immutable name/public status, editable optional description;
  - upload images з optional caption;
  - показ max 30 та залишку місць.
- Delete custom gallery має confirm із попередженням про видалення всіх фото.
- Viewer бачить galleries/items, але не бачить mutation controls.
- Coordinator і volunteer мають однакові controls у межах цього епіка.
- Обробити empty/loading/error states та backend error codes.
- Не реалізовувати reorder/cover/move/delete item тут: це GAL-9.

## Критерії приймання

- Картка авто відображає main навіть коли вона порожня.
- Можна створити/редагувати/видалити custom gallery і завантажити фото.
- Custom gallery default switch private.
- Viewer UI read-only.
- Після mutations коректно invalidated gallery queries без повного reload.

## Релевантні файли

- `apps/client/src/pages/vehicles/VehicleCardPage.tsx`
- `apps/client/src/api/vehicles.api.ts`
- `apps/client/src/hooks/useVehicles.ts`
- `apps/client/src/modals/VehicleGalleryModal.tsx` (новий)
