---
id: ORG-4
epic: organizations-multitenancy
phase: 0
type: feat
status: done
depends_on: [ORG-1]
parallelizable: true
branch: feat/org-2-org-4-tenant-roles
pr:
---

# ORG-4 — Рефактор ролей і гарди

**Епік:** [organizations-multitenancy](../organizations-multitenancy.md) · **Фаза 0** · **Залежності:** ORG-1
(можна паралельно з ORG-2)

## Мета

Дворівнева авторизація замість пласких ролей (розд. 5 епіку).

## Обсяг

- `user_role {superuser, user}` у `shared` (заміна `ROLES`); enum `user_role` у схемі.
- **Прибрати `guest`** усюди (shared, бекенд-декоратори, фронт-форми).
- Нові `@OrgRoles(...)` + `OrgRolesGuard` + `OrgContextGuard` (вимагає `activeOrgId`); зберегти `@Roles`
  для платформного рівня.
- У коді/типах розрізняти `userRole`/`orgRole` (обидві колонки лишаються `role`).
- Розставити декоратори за матрицею розд. 5 (дані org → `@OrgRoles`, платформне → `@Roles(superuser)`).
- Довідники/exchange-rates: читання — будь-який автентифікований член, запис — `superuser`.

## Критерії приймання

- Білд зелений; ендпоінти декоровані за матрицею розд. 5; немає згадок `guest`.

## Релевантні файли

- [`packages/shared/src/types/roles.ts`](../../../packages/shared/src/types/roles.ts), [`schemas/auth.ts`](../../../packages/shared/src/schemas/auth.ts)
- [`common/decorators/roles.decorator.ts`](../../../apps/server/src/common/decorators/roles.decorator.ts) + новий `org-roles.decorator.ts`
- [`common/guards/roles.guard.ts`](../../../apps/server/src/common/guards/roles.guard.ts) + нові `org-roles.guard.ts`, `org-context.guard.ts`
- Контролери з `@Roles`: vehicles, expenses, documents, dashboard, users, dictionaries, exchange-rates
- Фронт: [`UserFormModal.tsx`](../../../apps/client/src/modals/UserFormModal.tsx), [`UsersPage.tsx`](../../../apps/client/src/pages/admin/UsersPage.tsx)
