---
id: BUG-2
epic: organizations-multitenancy
type: bug
status: todo
severity: high
found_in: [ORG-12]
branch:
---

# BUG-2 — Створення організації падає: `user.userId` замість `user.sub`

**Епік:** [organizations-multitenancy](../../organizations-multitenancy.md) · **Знайдено в:** ORG-12

## Симптом

`POST /api/v1/organizations` завершується помилкою 500. Новостворена організація (якщо запис усе ж потрапляє в БД) матиме `created_by = NULL`, що порушує `NOT NULL`-обмеження колонки.

## Першопричина

```ts
// apps/server/src/modules/organizations/organizations.controller.ts:41
return this.organizationsService.create(input, user.userId);
```

`JwtPayload` (з `jwtPayloadSchema`) не має поля `userId` — ідентифікатор користувача зберігається в `sub`. TypeScript не дає помилку компіляції, бо зайві властивості на об'єктах runtime не заборонені, але під час виконання `user.userId` → `undefined`.

## Виправлення

```ts
// apps/server/src/modules/organizations/organizations.controller.ts:41
return this.organizationsService.create(input, user.sub);
```

## Критерії приймання

- `POST /api/v1/organizations` успішно створює організацію з правильним `created_by`.
- Жодних `user.userId` у контролерах (перевірити весь `organizations.controller.ts`).

## Релевантні файли

- [`apps/server/src/modules/organizations/organizations.controller.ts`](../../../../apps/server/src/modules/organizations/organizations.controller.ts)
- [`packages/shared/src/schemas/auth.ts`](../../../../packages/shared/src/schemas/auth.ts) — визначення `JwtPayload`
