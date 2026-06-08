---
id: ORG-13
epic: organizations-multitenancy
phase: 3
type: feat
status: ready
depends_on: [ORG-4, ORG-5]
parallelizable: true
branch:
pr:
---

# ORG-13 — API учасників (coordinator у межах активної org)

**Епік:** [organizations-multitenancy](../organizations-multitenancy.md) · **Фаза 3** · **Залежності:**
ORG-4, ORG-5 (паралельно з ORG-12)

## Мета

Дати coordinator керувати власною організацією та її складом.

## Обсяг

- `@OrgRoles(coordinator)`: список учасників активної org, додавання існуючого за email, зміна ролі,
  зняття; редагування інфо своєї організації.
- **Без** створення нових глобальних користувачів (це робить superuser у ORG-12).
- Захист: зняти себе/останнього `coordinator` — заборонено (щоб org не лишилась без адміна).

## Критерії приймання

- Coordinator керує лише своєю org (інша org недоступна).
- Додавання неіснуючого email → помилка.
- Не можна зняти останнього coordinator.

## Інваріанти

1–2 (дії лише в межах активної org).

## Релевантні файли

- `apps/server/src/modules/organizations/` (members-ендпоінти; спільно з ORG-12)
