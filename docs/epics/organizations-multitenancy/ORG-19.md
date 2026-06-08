---
id: ORG-19
epic: organizations-multitenancy
phase: 5
type: docs
status: todo
depends_on: [ORG-3, ORG-5, ORG-6, ORG-11, ORG-12, ORG-13, ORG-14]
parallelizable: false
branch:
pr:
---

# ORG-19 — Документація

**Епік:** [organizations-multitenancy](../organizations-multitenancy.md) · **Фаза 5** · **Залежності:**
Фази 0–4

## Мета

Привести довідкову документацію у відповідність до фактичної моделі.

## Обсяг

- Новий запис ADR у [architecture-decisions.md](../../architecture-decisions.md): чому pool-model +
  app-layer enforcement + дворівневі ролі + cookie-only.
- Оновити [database.md](../../database.md) (organizations, organization_members, org_id, drop slug).
- Оновити [auth-and-security.md](../../auth-and-security.md) (cookie-only, активна org у JWT, CSRF-постава).
- Оновити [overview.md](../../overview.md) (ролі, сценарії з організаціями).

## Критерії приймання

- Документи відображають фактичну модель; ADR фіксує «чому».

## Релевантні файли

- [`docs/architecture-decisions.md`](../../architecture-decisions.md), [`database.md`](../../database.md), [`auth-and-security.md`](../../auth-and-security.md), [`overview.md`](../../overview.md)
