---
id: BUG-1
epic: vehicle-galleries
type: bug
status: done
severity: medium
found_in: [GAL-2]
branch: feat/gal-1-11-gallery
---

# BUG-1 — Повторний прогін міграції 0000 падає на змігрованій БД (стан після 0005)

**Епік:** [vehicle-galleries](../../vehicle-galleries.md) · **Знайдено в:** GAL-2 (перевірка міграцій
галерей) · **Передіснуючий** — галерей не стосується.

## Контекст

Робочий процес міграцій у проєкті (pre-prod, без даних на проді): міграції пишуться руками і мають
бути **ідемпотентними** — допускається редагування наявних міграцій (greenfield) і повторне
застосування `.sql` до вже змігрованої БД (через `psql`/`tsx`, в обхід journal). Для цього в
`0000_*.sql` використані гарди `IF NOT EXISTS` та `DO $$ ... EXCEPTION WHEN duplicate_object`.
Див. [database.md](../../../database.md).

> `drizzle-kit migrate` сам по собі не ре-ранить застосовані міграції (journal), тож проблема
> проявляється лише при ручному повторному застосуванні — але саме на ньому тримається прийнятий
> воркфлоу «редагуємо наявні міграції».

## Симптом

Повторний прогін `0000_wealthy_catseye.sql` на БД, що вже пройшла всі міграції до `0005`, падає на
старих FK таблиці `expenses` (виявлено під час GAL-2; чистий прогін усього ланцюжка з нуля — ок).

## Першопричина

Гарди в `0000` ловлять **лише** `duplicate_object`, а `0005_youthful_absorbing_man.sql` змінює стан
так, що повторне виконання `0000` падає з іншими класами помилок:

- `0005` перейменовує `expense_categories` → `financial_categories` і дропає `funding_sources` /
  колонку `expenses.funding_source_id`;
- повторний `0000` спершу **створює заново порожні** `expense_categories` і `funding_sources`
  (`CREATE TABLE IF NOT EXISTS` спрацьовує, бо таблиць уже нема) — побічний ефект: сміттєві таблиці;
- далі `ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk"` падає (наявні
  `expenses.category_id` посилаються на рядки `financial_categories`, яких нема в порожній
  `expense_categories` → `foreign_key_violation`), а
  `ADD CONSTRAINT "expenses_funding_source_id_funding_sources_id_fk"` — на відсутній колонці
  (`undefined_column`). Жоден з цих кодів не покритий `WHEN duplicate_object`.

Додатково: сама `0005` **взагалі без гардів** (голі `DROP CONSTRAINT` / `DROP COLUMN` / `RENAME`
без `IF EXISTS`), тож її повторний прогін теж не ідемпотентний.

## Бажана поведінка

Повторний прогін будь-якої міграції (і всього ланцюжка `0000..0005`) на вже змігрованій БД
завершується без помилок і без побічних ефектів (no-op).

## Рішення (2026-06-10)

Точкові фікси (консолідація `0005` у `0000`, розширення exception-гардів) **не робимо**.
Історію міграцій повністю переписано з фінальної TS-схеми після GAL-епіку. Pre-prod дозволяє
дропнути БД і підняти проєкт з нуля, тож стару history не збережено.

Правило просте: міграції застосовуються **тільки на чисту БД**; повторне застосування окремих
`.sql` до змігрованої бази не підтримується — за потреби локальну БД перестворюємо.

### Реалізація

- `0000_init.sql` згенеровано з фінальної TS-схеми разом з новими snapshots і journal.
- `0001_vehicle_alerts_view.sql` залишено custom-міграцією з `CREATE OR REPLACE VIEW`, щоб
  подальші ручні зміни view мали окрему точку.
- Чистий прогін `db:migrate` + `db:seed` перевірено на окремій порожній БД.
- Повторний `pnpm db:generate` повертає `No schema changes, nothing to migrate`.
- Серверні тести: 210 passed; загальний typecheck пройдено.

## Критерії приймання

- Один згенерований `0000` (+ рукописна view-міграція) описує фінальний стан схеми.
- `pnpm infra:up && pnpm db:migrate && pnpm db:seed && pnpm dev` працює на порожньому Postgres.
- `drizzle-kit generate` на свіжому стані каже `No schema changes` (snapshots узгоджені).

## Релевантні файли

- [`apps/server/drizzle/0000_wealthy_catseye.sql`](../../../../apps/server/drizzle/0000_wealthy_catseye.sql)
- [`apps/server/drizzle/0005_youthful_absorbing_man.sql`](../../../../apps/server/drizzle/0005_youthful_absorbing_man.sql)
- [`apps/server/drizzle/meta/`](../../../../apps/server/drizzle/meta/)
