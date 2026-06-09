---
id: FIN-2
epic: financial-flow
phase: 0
type: feat
status: done
depends_on: [FIN-1]
parallelizable: false
branch: feat/fin-phase-0
pr:
---

# FIN-2 — Схема `donors` + `organization_donors`

**Епік:** [financial-flow](../financial-flow.md) · **Фаза 0** · **Залежності:** FIN-1

## Мета

Глобальна donor identity з org-scoped visibility: один донор може бути доступний кільком організаціям без дублювання запису.

## Обсяг

- Drizzle-таблиця `donors` — **глобальна, без `organization_id`** (розд. 5.1): `id`, `name` (не unique), `normalized_name`, `created_by`, timestamps.
- Drizzle-таблиця `organization_donors` — junction видимості (розд. 5.2): composite PK `(organization_id, donor_id)`, `is_active` (default `true`), `added_by`, `updated_by`, timestamps.
- Індекси: `organization_donors(organization_id, is_active)`, `(donor_id)`; **non-unique** index на `donors.normalized_name`.
- Normalization helper (сервер): `trim` → collapse whitespace → Unicode lowercase. Допоміжне поле, не глобальний unique key.
- Relations (donors ↔ organization_donors ↔ organizations/users).

> Composite PK `(organization_id, donor_id)` на `organization_donors` — target для composite FK з `donations` (FIN-3).

## Критерії приймання

- Один donor UUID можна зв'язати з кількома org; список донорів отримується **лише** через junction.
- `normalize(name)` детермінований; повторне додавання того самого ID ставить `is_active = true`.

## Інваріанти

Donor list ніколи не читає `donors` без join/filter через `organization_donors` (розд. 10 п.6).

## Релевантні файли

- `apps/server/src/db/schema/donors.ts` (новий)
- [`apps/server/src/db/schema/index.ts`](../../../apps/server/src/db/schema/index.ts), [`relations.ts`](../../../apps/server/src/db/schema/relations.ts)
- `apps/server/src/common/utils/` — normalize helper
