---
id: GAL-4
epic: vehicle-galleries
phase: 1
type: feat
status: ready
depends_on: [GAL-3]
parallelizable: false
branch:
pr:
---

# GAL-4 — Gallery items: upload, read, caption, download

**Епік:** [vehicle-galleries](../vehicle-galleries.md) · **Фаза 1** · **Залежності:** GAL-3

## Мета

Замінити backend photo flow на gallery items з лімітом 30 зображень на галерею.

## Обсяг

- Реалізувати upload item (`multipart file + optional caption`) і додавання в кінець gallery.
- Реалізувати edit caption та authenticated download.
- Інтегрувати items у gallery list response.
- Ліміт 30 рахує лише active items конкретної gallery.
- Upload конкурентно безпечний: lock gallery/atomic check не дозволяє двом запитам створити 31-й item.
- MIME sniffing та allowed types: JPEG, PNG, WebP, HEIC; зберегти чинний max upload bytes.
- Зберігати sanitized `originalName`; object key використовує
  `vehicle-galleries/{vehicleId}/{galleryId}/{itemId}/...`.
- Download перевіряє active org, vehicle, gallery та item, а не шукає лише за item ID.
- Доступ: read/download для всіх трьох org roles; upload/edit для coordinator/volunteer.
- Перевести серверні споживачі старого `VehiclePhotosService` на gallery item service настільки,
  щоб runtime не залежав від видаленої таблиці.
- Додати unit/integration tests для MIME, size, 30/31, concurrent upload та cross-org access.

## Критерії приймання

- У gallery можна завантажити 30 active images, 31-й дає `GALLERY_ITEM_LIMIT_EXCEEDED`.
- Паралельний upload не обходить ліміт.
- Caption round-trip працює, empty caption стає null.
- Authenticated download чужого item повертає 404.
- Файл зберігається без image processing.

## Релевантні файли

- `apps/server/src/modules/vehicles/vehicle-gallery-items.service.ts` (новий)
- `apps/server/src/modules/vehicles/vehicles.controller.ts`
- `apps/server/src/storage/storage.service.ts`
- `apps/server/src/modules/vehicles/vehicle-photos.service.ts` (заміна/видалення)
