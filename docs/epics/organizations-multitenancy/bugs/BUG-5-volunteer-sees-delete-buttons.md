---
id: BUG-5
epic: organizations-multitenancy
type: bug
status: todo
severity: low
found_in: [ORG-17]
branch:
---

# BUG-5 — Volunteer бачить кнопки Delete для витрат і документів

**Епік:** [organizations-multitenancy](../../organizations-multitenancy.md) · **Знайдено в:** ORG-17

## Симптом

На сторінці авто (`VehicleCardPage`) користувач з `orgRole = 'volunteer'` бачить кнопку Delete у таблицях витрат і документів. Натискання призводить до помилки 403 від бекенду, хоча UI не повинен показувати недоступні дії.

> Backend захищений коректно (`@OrgRoles('coordinator')`). Баг — тільки у відображенні.

## Першопричина

```ts
// apps/client/src/pages/vehicles/VehicleCardPage.tsx:133
const canMutate = orgRole !== null && orgRole !== 'viewer';
```

`canMutate = true` для `volunteer` **і** `coordinator`. Обидва блоки — колонка дій у витратах (рядки 619–645) і кнопки Edit/Delete у документах (рядки 775–797) — використовують `canMutate`, тому Delete відображається для volunteer.

Матриця ролей (spec, розд. 5):

| Дія       | coordinator | volunteer | viewer |
| --------- | :---------: | :-------: | :----: |
| Видалення |     ✅      |    ❌     |   ❌   |

## Виправлення

Додати окрему змінну і використати її там, де є Delete:

```ts
// VehicleCardPage.tsx
const canMutate = orgRole !== null && orgRole !== 'viewer';
const canDelete = orgRole === 'coordinator';
```

**Витрати** (рядок ~638): замінити `canMutate` на `canDelete` для кнопки Delete (або винести Delete в окремий рядок колонки поза `canMutate`-блоком).

**Документи** (рядок ~775): розбити блок `{canMutate && (<> Edit + Delete </>)}` на два окремих:

```tsx
{
  canMutate && <EditButton />;
}
{
  canDelete && <DeleteButton />;
}
```

## Критерії приймання

- Volunteer не бачить кнопок Delete для витрат і документів.
- Coordinator бачить і Edit, і Delete.
- Viewer не бачить ні Edit, ні Delete.

## Релевантні файли

- [`apps/client/src/pages/vehicles/VehicleCardPage.tsx`](../../../../apps/client/src/pages/vehicles/VehicleCardPage.tsx) — рядки 133, 619–645, 775–797
