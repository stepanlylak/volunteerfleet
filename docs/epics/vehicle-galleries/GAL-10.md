---
id: GAL-10
epic: vehicle-galleries
phase: 2
type: feat
status: ready
depends_on: [GAL-6, GAL-7]
parallelizable: true
branch:
pr:
---

# GAL-10 — Public UI та обкладинки у списках

**Епік:** [vehicle-galleries](../vehicle-galleries.md) · **Фаза 2** · **Залежності:** GAL-6, GAL-7

## Мета

Відобразити public galleries окремими секціями та використовувати main cover як preview автомобіля.

## Обсяг

- Оновити public API client з `photos` на `galleries`.
- Public vehicle page показує кожну gallery окремою секцією:
  name, optional description, ordered image grid/preview group.
- Main label — «Основна»; custom names беруться з даних.
- Не рендерити empty public gallery section, якщо в ній немає items, якщо product UI не потребує
  показу самого опису; це рішення покрити тестом.
- Замінити public photo download URL на public gallery item URL.
- Додати main cover у vehicle list/card UI з placeholder для null.
- Якщо наявні public report cards відображають автомобілі, використати ту саму main cover;
  не створювати нових reports.
- Зберегти responsive layout та image preview.
- Додати component tests: кілька galleries, descriptions, no photos, cover/placeholder.

## Критерії приймання

- Public page не використовує legacy `photos`.
- Main і public custom galleries візуально розділені.
- Private custom gallery відсутня, бо її немає в API payload.
- Vehicle list використовує effective main cover.
- Missing cover не створює broken image.

## Релевантні файли

- `apps/client/src/pages/public/PublicVehiclePage.tsx`
- `apps/client/src/api/public.api.ts`
- `apps/client/src/pages/vehicles/VehiclesListPage.tsx`
- public/list component tests
