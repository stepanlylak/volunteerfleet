---
id: GAL-9
epic: vehicle-galleries
phase: 2
type: feat
status: todo
depends_on: [GAL-5, GAL-8]
parallelizable: true
branch:
pr:
---

# GAL-9 — Повне керування фото у модалці

**Епік:** [vehicle-galleries](../vehicle-galleries.md) · **Фаза 2** · **Залежності:** GAL-5, GAL-8

## Мета

Додати до gallery modal сортування, підписи, cover, move та delete item.

## Обсяг

- Додати API/hooks для caption update, reorder, set/reset cover, move та delete item.
- Реалізувати reorder відповідно до наявного UI-патерну; optimistic UI допускається лише з rollback.
- Редагувати optional caption кожного фото.
- Позначати explicit/effective cover та дозволяти set/reset.
- Move picker показує інші active galleries цього vehicle та їхню доступну місткість.
- Після move item з'являється в кінці target; caption зберігається.
- Якщо moved/deleted item був explicit cover, UI показує fallback first item без автоматичного
  вибору нової explicit cover.
- Delete item з confirm; volunteer може видалити item іншого автора.
- Заблокувати upload/move, якщо gallery має 30 items; server errors лишаються authoritative.
- Забезпечити keyboard-accessible controls і коректні loading states.
- Додати component tests основних flows.

## Критерії приймання

- Порядок після reload відповідає UI.
- Caption, set/reset cover, move і delete працюють без stale cache.
- Target gallery з 30 items не приймає move.
- Cover fallback після delete/move відображається правильно.
- Viewer не має mutation controls.

## Релевантні файли

- `apps/client/src/modals/VehicleGalleryModal.tsx`
- `apps/client/src/api/vehicles.api.ts`
- `apps/client/src/hooks/useVehicles.ts`
- gallery modal/component tests
