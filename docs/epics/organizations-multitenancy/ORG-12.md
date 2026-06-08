---
id: ORG-12
epic: organizations-multitenancy
phase: 3
type: feat
status: done
depends_on: [ORG-4, ORG-5]
parallelizable: true
branch: feat/org-12-organizations-api
pr:
---

# ORG-12 — API організацій (платформний superuser)

**Епік:** [organizations-multitenancy](../organizations-multitenancy.md) · **Фаза 3** · **Залежності:**
ORG-4, ORG-5 (паралельно з ORG-13)

## Мета

Дати superuser керування організаціями та їхнім складом з боку платформи.

## Обсяг

- Новий модуль `organizations` (controller/service/module), `@Roles(superuser)`.
- CRUD організацій: список / створення / редагування (**без видалення**).
- Призначення/зміна/зняття учасників у **будь-яку** організацію по `user_id` (лукап існуючого
  користувача за email; неіснуючий → помилка).

## Критерії приймання

- Superuser створює org, додає існуючого користувача за email, міняє роль, знімає членство (запис user
  лишається).
- Додавання неіснуючого email → зрозуміла помилка.

## Релевантні файли

- `apps/server/src/modules/organizations/` (новий модуль)
- [`apps/server/src/app.module.ts`](../../../apps/server/src/app.module.ts) — підключення
- [`users.service.ts`](../../../apps/server/src/modules/users/users.service.ts) — `findByEmail`
