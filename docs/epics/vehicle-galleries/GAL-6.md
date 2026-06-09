---
id: GAL-6
epic: vehicle-galleries
phase: 1
type: feat
status: todo
depends_on: [GAL-5]
parallelizable: true
branch:
pr:
---

# GAL-6 — Public API та visibility chain

**Епік:** [vehicle-galleries](../vehicle-galleries.md) · **Фаза 1** · **Залежності:** GAL-5

## Мета

Публічно віддавати main і дозволені custom galleries, не допускаючи прямого доступу до приватних files.

## Обсяг

- Замінити `PublicVehicleResponse.photos` на `galleries`.
- Public vehicle response повертає active galleries лише коли vehicle active та `isPublic = true`.
- Серед galleries повертати лише `isPublic = true`; main має потрапляти автоматично.
- Response містить gallery name/description/order/effective cover та ordered items з caption.
- Для main формувати UI label «Основна» через shared presentation config, не user-editable DB text.
- Замінити public photo download на gallery item download.
- Download перевіряє active/public vehicle, active/public gallery та active item.
- Private custom gallery/item і non-public vehicle завжди повертають 404.
- Оновити public controller/service tests та OpenAPI contracts.
- Не додавати новий тип public report; підготувати контракт для наявних сторінок/звітів.

## Критерії приймання

- Public vehicle true показує main та лише public custom galleries.
- Vehicle false приховує все незалежно від gallery flags.
- Direct URL приватного item повертає 404.
- Soft-deleted gallery/item не потрапляє у response/download.
- `photos` відсутнє у фінальному public contract.

## Релевантні файли

- `apps/server/src/modules/public/public.service.ts`
- `apps/server/src/modules/public/public.controller.ts`
- `apps/server/src/modules/public/public.service.spec.ts`
- `packages/shared/src/schemas/public.ts`
