---
id: GAL-2
epic: vehicle-galleries
phase: 0
type: feat
status: todo
depends_on: [GAL-1]
parallelizable: false
branch:
pr:
---

# GAL-2 — Схема БД, міграції та relations

**Епік:** [vehicle-galleries](../vehicle-galleries.md) · **Фаза 0** · **Залежності:** GAL-1

## Мета

Створити цільову greenfield-схему галерей, не ламаючи ще не переведений runtime photo flow.

## Обсяг

- Додати enum `vehicle_gallery_kind` (`main`, `custom`).
- Додати enum `vehicle_gallery_item_type` (`image`).
- Додати `vehicle_galleries` та `vehicle_gallery_items` за розділом 4 епіка.
- Додати audit fields, tenant columns, checks, partial unique indexes та order indexes.
- Реалізувати `cover_item_id` з FK або еквівалентним DB constraint, який не залишає довільний UUID;
  same-gallery/same-org перевірка додатково лишається у сервісі.
- Додати Drizzle relations для galleries/items.
- Відредагувати наявні міграції як greenfield; backfill не створювати.
- Legacy `vehicle_photos` і його relations тимчасово залишити, доки GAL-4 не переведе runtime;
  остаточне видалення зі схеми та greenfield-міграції виконується у GAL-11.
- Не створювати compatibility aliases між `vehicle_photos` і `vehicle_gallery_items`: це різні
  моделі з різними інваріантами.

## Критерії приймання

- БД після migrate має обидві нові таблиці; тимчасова legacy-таблиця явно позначена для GAL-11.
- DB гарантує максимум одну активну main gallery на авто.
- Active custom gallery names унікальні case-insensitive у межах авто.
- Checks не дозволяють main з custom metadata/private flag/non-zero order.
- Drizzle schema, migration snapshots і relations узгоджені.
- `pnpm db:migrate`, typecheck і schema tests зелені.

## Релевантні файли

- `apps/server/src/db/schema/vehicle-galleries.ts` (новий)
- `apps/server/src/db/schema/vehicle-gallery-items.ts` (новий)
- `apps/server/src/db/schema/enums.ts`
- `apps/server/src/db/schema/relations.ts`
- `apps/server/src/db/schema/index.ts`
- `apps/server/drizzle/`
