---
id: ORG-15
epic: organizations-multitenancy
phase: 4
type: feat
status: done
depends_on: [ORG-12, ORG-14]
parallelizable: true
branch: feat/org-15-16-organizations-ui
pr:
---

# ORG-15 — Платформні сторінки організацій

**Епік:** [organizations-multitenancy](../organizations-multitenancy.md) · **Фаза 4** · **Залежності:**
ORG-12, ORG-14 (паралельно з ORG-16/17)

## Мета

UI для superuser: керування організаціями та їхнім складом.

## Обсяг

- Сторінки: список / створення / редагування організацій.
- Екран призначення учасників у будь-яку org (додати існуючого за email, змінити роль, зняти).
- Наявну глобальну сторінку користувачів лишити в платформній зоні (концептуально «глобальні
  користувачі»).
- Роутинг під `@Roles(superuser)` (RoleGuard).

## Критерії приймання

- Superuser повноцінно керує організаціями та складом з UI.
- Сторінки недоступні для `user`.

## Релевантні файли

- `apps/client/src/pages/admin/` (нові сторінки організацій), [`UsersPage.tsx`](../../../apps/client/src/pages/admin/UsersPage.tsx)
- [`router.tsx`](../../../apps/client/src/router.tsx), [`RoleGuard`](../../../apps/client/src/components/guards/)
