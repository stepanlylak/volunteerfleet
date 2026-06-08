---
id: ORG-3
epic: organizations-multitenancy
phase: 0
type: chore
status: done
depends_on: [ORG-1, ORG-2, ORG-4]
parallelizable: false
branch: feat/org-2-org-4-tenant-roles
pr:
---

# ORG-3 — Reset міграцій і сіди (greenfield)

**Епік:** [organizations-multitenancy](../organizations-multitenancy.md) · **Фаза 0** · **Залежності:**
ORG-1, ORG-2, ORG-4 (схема й enum'и мають бути фінальними)

## Мета

Чиста схема з нуля без бекфілу — живих даних немає (розд. 8 епіку).

## Обсяг

- Видалити наявні згенеровані міграції в `apps/server/drizzle/`.
- Регенерувати **єдину** початкову міграцію з фінальної схеми (`pnpm db:generate`), перевірити SQL очима.
- Перестворити dev/test БД (drop + create) і прогнати `pnpm db:migrate`.
- Оновити сіди: `seed.ts` (superuser + ≥1 org + членства + скоуплені дані), `seed-demo.ts` (≥2 org з
  різними складами для ручної перевірки ізоляції), за потреби `seed-ids.ts`.

## Критерії приймання

- `pnpm db:migrate && pnpm db:seed` піднімає чисту БД одним прогоном.
- `seed-demo` дає ≥2 організації з різними складами учасників.
- Жодних залишків `public_slug` чи старих ролей (`admin/volunteer/guest`).

## Релевантні файли

- `apps/server/drizzle/` (регенерація), [`drizzle.config.ts`](../../../apps/server/drizzle.config.ts)
- [`apps/server/src/scripts/seed.ts`](../../../apps/server/src/scripts/seed.ts), `seed-demo.ts`, `seed-ids.ts`
- `docker/postgres/init.sql` (за потреби)
