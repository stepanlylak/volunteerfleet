---
id: VSF-17
epic: vehicle-status-flow
phase: 0
type: chore
status: todo
depends_on: [VSF-5]
parallelizable: false
branch: chore/vsf-17-migrations-seed-baseline
pr:
---

# VSF-17 — Консолідація міграцій + чистка seed

**Епік:** [vehicle-status-flow](../vehicle-status-flow.md) · **Фаза 0** · **Залежності:** VSF-5 (фінальна схема Фази 0)

> **Момент:** виконувати разом із VSF-5 / одразу після нього — коли схема вже фінальна і seed усе одно переписується.

## Мета

Привести міграції та seed до чистого ідемпотентного стану після всіх схемних змін Фази 0.

## Обсяг

- Грамотно змерджити існуючі міграції (`0000`, `0001`) і дописати все, чого бракує для епіку.
- Кожна міграція **ідемпотентна** — повторний `db:migrate` не ламає схему й не фейлить скрипт (`IF NOT EXISTS` / `IF EXISTS`, guard'и для enum-значень).
- **Видалити `seed-demo.ts`** повністю (скрипт у `package.json`, реєстрації, згадки) — не використовується і заважає.
- **Прибрати створення організації з `seed.ts`**: seed більше не сідить org і членство. Перший superuser створює організацію сам і вручну асайнить мемберів.
- Перевірити/допиляти роль `superuser`, коли він **не є членом жодної організації** (глобальні дії доступні; відсутність org-context не валить запити, де org не потрібен).

## Критерії приймання

- `db:migrate` двічі поспіль — зелений, схема не змінюється.
- `seed-demo` відсутній; `db:seed` не створює org.
- Superuser без членства логіниться, створює org і призначає мемберів; глобальні запити superuser не падають через відсутність активної org.

## Релевантні файли

- `apps/server/drizzle/` (міграції, `meta/`)
- [`apps/server/src/scripts/seed.ts`](../../../apps/server/src/scripts/seed.ts), [`seed-ids.ts`](../../../apps/server/src/scripts/seed-ids.ts), `seed-demo.ts` (видалити)
- [`apps/server/src/common/guards/org-context.guard.ts`](../../../apps/server/src/common/guards/org-context.guard.ts)
