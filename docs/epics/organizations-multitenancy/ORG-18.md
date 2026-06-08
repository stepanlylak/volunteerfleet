---
id: ORG-18
epic: organizations-multitenancy
phase: 5
type: test
status: todo
depends_on: [ORG-7, ORG-8, ORG-9, ORG-10, ORG-11, ORG-12, ORG-13, ORG-14]
parallelizable: false
branch:
pr:
---

# ORG-18 — Тести

**Епік:** [organizations-multitenancy](../organizations-multitenancy.md) · **Фаза 5** · **Залежності:**
Фази 2–4

## Мета

Закріпити ізоляцію тенантів і ключові інваріанти автотестами.

## Обсяг

- Тести ізоляції: крос-org доступ (read/update/delete/download) → 404 для vehicles/expenses/documents.
- Гарди: `OrgRolesGuard`, `OrgContextGuard`, `@Roles(superuser)`.
- `switch-org`: валідація членства, перевипуск куки.
- Same-org валідація крос-зв'язків (expense↔vehicle, document↔vehicle/expense).
- Cookie-only auth: тіло відповідей не містить токена.

> Сіди для багатоорг-сценаріїв оновлено в [ORG-3](ORG-3.md).

## Критерії приймання

- Тести ізоляції зелені в CI.

## Релевантні файли

- `*.spec.ts` у модулях vehicles/expenses/documents/public/auth
- [`testing.md`](../../testing.md) — підхід до тестів
