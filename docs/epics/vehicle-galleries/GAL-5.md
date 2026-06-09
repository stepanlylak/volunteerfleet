---
id: GAL-5
epic: vehicle-galleries
phase: 1
type: feat
status: todo
depends_on: [GAL-4]
parallelizable: false
branch:
pr:
---

# GAL-5 — Reorder, cover, move і soft-delete

**Епік:** [vehicle-galleries](../vehicle-galleries.md) · **Фаза 1** · **Залежності:** GAL-4

## Мета

Реалізувати повний набір операцій керування items і точну семантику обкладинки.

## Обсяг

- Reorder items за повним набором active IDs однієї gallery.
- Set/reset explicit cover через окремий endpoint.
- Обчислювати `effectiveCoverItemId`: explicit active cover, інакше перший active item, інакше null.
- Move item між galleries одного vehicle зі збереженням caption і додаванням у кінець target.
- Перевіряти target limit 30 до move.
- Soft-delete item без фізичного видалення MinIO object.
- При move/delete explicit cover очистити source `coverItemId`; не записувати fallback ID.
- Після delete/move нормалізувати order source gallery без дублікатів/дір, якщо це є обраною
  інваріантою сервісу.
- Lock source/target у стабільному порядку; операції мають бути конкурентно безпечні.
- Coordinator і volunteer можуть reorder/set cover/move/delete будь-який item; прибрати owner check.
- Додати tests для invalid sets, foreign IDs, cover fallback, target full і concurrency.

## Критерії приймання

- Reorder не приймає duplicate, missing або foreign item IDs.
- Cover може бути лише active image цієї gallery.
- Move зберігає caption та не створює 31-й item у target.
- Delete/move cover очищує explicit link; effective cover стає першим item без DB auto-write.
- Volunteer може видалити item, створений іншим користувачем.

## Релевантні файли

- `apps/server/src/modules/vehicles/vehicle-gallery-items.service.ts`
- `apps/server/src/modules/vehicles/vehicle-galleries.service.ts`
- `apps/server/src/modules/vehicles/vehicles.controller.ts`
