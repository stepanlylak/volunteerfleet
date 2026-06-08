---
id: BUG-1
epic: organizations-multitenancy
type: bug
status: todo
severity: medium
found_in: [ORG-5, ORG-14]
branch:
---

# BUG-1 — `memberships` не містить `name` організації

**Епік:** [organizations-multitenancy](../../organizations-multitenancy.md) · **Знайдено в:** ORG-5, ORG-14

## Симптом

Org switcher у хедері показує UUID організації замість назви. У коді є TODO-коментар, що підтверджує проблему:

```ts
// AppLayout.tsx:164
label: m.organizationId, // TODO: Назва організації буде в наступних тікетах або вже є в моделі?
```

## Першопричина

Три місця, що порушують контракт spec (ORG-5: `memberships: [{ organizationId, name, role }]`):

1. **`orgMembershipSchema`** не має поля `name`:

   ```ts
   // packages/shared/src/schemas/auth.ts:7-10
   export const orgMembershipSchema = z.object({
     organizationId: uuidSchema,
     role: z.enum(ORG_ROLES),
     // name відсутній
   });
   ```

2. **`getUserMemberships`** не джойнить таблицю `organizations`:

   ```ts
   // apps/server/src/modules/users/users.service.ts:157-165
   async getUserMemberships(userId: string) {
     return this.db
       .select({
         organizationId: organizationMembers.organizationId,
         role: organizationMembers.role,
         // organizations.name не вибирається
       })
       .from(organizationMembers)
       .where(eq(organizationMembers.userId, userId));
   }
   ```

3. **`AppLayout.tsx`** використовує `m.organizationId` як label замість `m.name`.

## Виправлення

### 1. `packages/shared/src/schemas/auth.ts`

```ts
export const orgMembershipSchema = z.object({
  organizationId: uuidSchema,
  name: nonEmptyString,
  role: z.enum(ORG_ROLES),
});
```

### 2. `apps/server/src/modules/users/users.service.ts`

Додати join з `organizations` і вибирати `name`:

```ts
async getUserMemberships(userId: string) {
  return this.db
    .select({
      organizationId: organizationMembers.organizationId,
      name: organizations.name,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(eq(organizationMembers.userId, userId));
}
```

### 3. `apps/client/src/components/layout/AppLayout.tsx`

```ts
label: m.name,  // замість m.organizationId
```

## Критерії приймання

- Org switcher відображає назву організації (не UUID).
- `pnpm -w typecheck` зелений.
- `orgMembershipSchema` містить `name`.

## Релевантні файли

- [`packages/shared/src/schemas/auth.ts`](../../../../packages/shared/src/schemas/auth.ts)
- [`apps/server/src/modules/users/users.service.ts`](../../../../apps/server/src/modules/users/users.service.ts)
- [`apps/client/src/components/layout/AppLayout.tsx`](../../../../apps/client/src/components/layout/AppLayout.tsx)
