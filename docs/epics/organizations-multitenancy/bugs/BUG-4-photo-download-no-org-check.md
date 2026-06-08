---
id: BUG-4
epic: organizations-multitenancy
type: bug
status: todo
severity: high
found_in: [ORG-7]
branch:
---

# BUG-4 — Завантаження фото не перевіряє приналежність до org

**Епік:** [organizations-multitenancy](../../organizations-multitenancy.md) · **Знайдено в:** ORG-7

## Симптом

Автентифікований користувач може завантажити фото авто з **іншої організації**, знаючи лише UUID фото. Порушується інваріант 1 епіку (ізоляція даних між організаціями).

## Першопричина

```ts
// apps/server/src/modules/vehicles/vehicles.controller.ts:234-248
@Get(':id/photos/:photoId/download')
@OrgRoles('coordinator', 'volunteer', 'viewer')
async downloadPhoto(
  @Param('photoId') photoId: string,
  @Res({ passthrough: true }) res: Response,
): Promise<StreamableFile> {
  const { body, contentType, contentLength } =
    await this.photosService.getDownloadStream(photoId); // activeOrgId не передається
  ...
}
```

- Декоратор `@CurrentUser()` відсутній — `activeOrgId` недоступний.
- `getDownloadStream(photoId, publicOnly?)` перевіряє лише `isPublic` при `publicOnly=true`; для автентифікованих — org-перевірки немає.

## Виправлення

### `vehicles.controller.ts`

```ts
@Get(':id/photos/:photoId/download')
@OrgRoles('coordinator', 'volunteer', 'viewer')
async downloadPhoto(
  @Param('photoId') photoId: string,
  @CurrentUser() user: JwtPayload | undefined,
  @Res({ passthrough: true }) res: Response,
): Promise<StreamableFile> {
  if (!user?.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
  const { body, contentType, contentLength } =
    await this.photosService.getDownloadStream(photoId, false, user.activeOrgId);
  ...
}
```

### `vehicle-photos.service.ts` — `getDownloadStream`

Додати параметр `activeOrgId` та перевірку:

```ts
async getDownloadStream(
  photoId: string,
  publicOnly = false,
  activeOrgId?: string,
): Promise<{ body: Readable; contentType: string; contentLength?: number }> {
  const row = await this.db.query.vehiclePhotos.findFirst({
    where: and(eq(vehiclePhotos.id, photoId), isNull(vehiclePhotos.deletedAt)),
    with: { vehicle: true },
  });
  if (!row || !row.vehicle || row.vehicle.deletedAt) {
    throw new NotFoundException(`Vehicle photo ${photoId} not found`);
  }
  if (publicOnly && !row.vehicle.isPublic) {
    throw new NotFoundException(`Vehicle photo ${photoId} not found`);
  }
  if (activeOrgId && row.vehicle.organizationId !== activeOrgId) {
    throw new NotFoundException(`Vehicle photo ${photoId} not found`);
  }
  ...
}
```

> Публічний ендпоінт (`public.service.ts`) викликає `getDownloadStream(photoId, true)` — не передає `activeOrgId`, поведінка не змінюється.

## Критерії приймання

- Запит на фото авто чужої org → 404.
- Запит на фото свого авто → файл повертається нормально.
- Публічний ендпоінт (`/public/vehicle-photos/:id/download`) продовжує працювати.

## Релевантні файли

- [`apps/server/src/modules/vehicles/vehicles.controller.ts`](../../../../apps/server/src/modules/vehicles/vehicles.controller.ts)
- [`apps/server/src/modules/vehicles/vehicle-photos.service.ts`](../../../../apps/server/src/modules/vehicles/vehicle-photos.service.ts)
- [`apps/server/src/modules/public/public.service.ts`](../../../../apps/server/src/modules/public/public.service.ts)
