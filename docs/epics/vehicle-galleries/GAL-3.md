---
id: GAL-3
epic: vehicle-galleries
phase: 1
type: feat
status: done
depends_on: [GAL-2]
parallelizable: false
branch: feat/gal-3-gallery-crud
pr:
---

# GAL-3 — Main gallery invariant + Gallery CRUD

**Епік:** [vehicle-galleries](../vehicle-galleries.md) · **Фаза 1** · **Залежності:** GAL-2

## Мета

Гарантувати main gallery для кожного авто та реалізувати керування додатковими галереями.

## Обсяг

- Створювати vehicle і main gallery в одній транзакції.
- Оновити test factories/fixtures: прямий insert vehicle має також створювати main, або
  використовувати централізований factory.
- Реалізувати `GET/POST/PATCH/DELETE /vehicles/:vehicleId/galleries`.
- List повертає main першою, custom за `sortOrder`, без soft-deleted rows.
- Custom create: required unique name, optional description, `isPublic = false` default,
  наступний `sortOrder`.
- Custom update: name/description/isPublic.
- Main update дозволяє лише description; name/kind/isPublic/sortOrder незмінні.
- Main delete відхиляється стабільним error code.
- Delete custom gallery у транзакції soft-delete'ить gallery та всі active items; MinIO не чіпати.
- Доступ: read для coordinator/volunteer/viewer; mutations для coordinator/volunteer.
- Усі запити мають org/vehicle scope; чужі IDs повертають 404.
- Додати service/controller tests, включно з duplicate name та permissions.

## Критерії приймання

- Після успішного create vehicle існує рівно одна active main gallery.
- Failure створення main rollback'ить vehicle.
- Custom gallery private by default.
- Main не можна перейменувати, приватизувати або видалити; description редагується.
- Volunteer може керувати custom galleries; viewer не може мутувати.
- Delete gallery soft-delete'ить її items атомарно.

## Релевантні файли

- `apps/server/src/modules/vehicles/vehicles.service.ts`
- `apps/server/src/modules/vehicles/vehicles.controller.ts`
- `apps/server/src/modules/vehicles/vehicle-galleries.service.ts` (новий)
- `apps/server/src/modules/vehicles/vehicles.module.ts`
