---
id: GAL-7
epic: vehicle-galleries
phase: 1
type: feat
status: ready
depends_on: [GAL-5]
parallelizable: true
branch:
pr:
---

# GAL-7 — Effective main cover у vehicle responses

**Епік:** [vehicle-galleries](../vehicle-galleries.md) · **Фаза 1** · **Залежності:** GAL-5

## Мета

Дати спискам і карткам автомобілів одну стабільну обкладинку без завантаження всіх galleries.

## Обсяг

- Додати nullable `mainGalleryCover` до vehicle list і detail responses.
- Обкладинка визначається лише з active main gallery за правилами effective cover.
- Повернути мінімальний summary: `itemId`, `mimeType`; file key назовні не віддавати.
- Реалізувати query без N+1 для vehicle list: lateral/subquery/join або еквівалентний bounded query.
- Reuse authenticated gallery item download URL для відображення.
- Soft-deleted gallery/item не може бути cover.
- Explicit invalid cover не маскує fallback: сервіс повертає перший active item.
- Додати query/service tests, включно з explicit, fallback, empty та list із кількома vehicles.

## Критерії приймання

- Vehicle list/detail повертає однакову effective main cover.
- Custom gallery ніколи не стає vehicle cover.
- Список не виконує окремий gallery query для кожного vehicle.
- Empty main gallery повертає `mainGalleryCover: null`.

## Релевантні файли

- `apps/server/src/modules/vehicles/vehicles.service.ts`
- `packages/shared/src/schemas/vehicle.ts`
- vehicle query/service specs
