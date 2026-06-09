---
id: FIN-3
epic: financial-flow
phase: 0
type: feat
status: ready
depends_on: [FIN-2]
parallelizable: false
branch: feat/fin-phase-0
pr:
---

# FIN-3 — Схема `donations`

**Епік:** [financial-flow](../financial-flow.md) · **Фаза 0** · **Залежності:** FIN-2

## Мета

Додати позитивні фінансові події (донати) як окрему доменну сутність із аудитом, soft delete і валютним курсом.

## Обсяг

- Drizzle-таблиця `donations` за розд. 6.1: `organization_id`, `donor_id`, `vehicle_id` (**NOT NULL**), `category_id` (nullable), `donation_date`, `amount_minor` (**bigint**, мінорні одиниці, CHECK `> 0`), `currency`, `rate` (`numeric(14,6)`, CHECK `> 0`, UAH=`1`), `rate_source`, `description`, audit, soft delete.
- **Composite FK** `(organization_id, donor_id) → organization_donors(organization_id, donor_id)` — донат не може посилатися на неприєднаного донора; окремі FK на `organizations` і `donors` — для явної цілісності й relations.
- Індекси розд. 6.1: `(organization_id)`, `(organization_id, donation_date)`, `(organization_id, donor_id, vehicle_id)`, `(donor_id, organization_id, vehicle_id)`, `(organization_id, category_id)`, `(organization_id, vehicle_id)`.
- Reuse `currency_code` / `rate_source` enums; relations org/vehicle/donor/category.

## Критерії приймання

- Схема відповідає розд. 6; `vehicle_id` обов'язковий; `amount_minor` (bigint) / `rate` не можуть бути `<= 0`.
- Composite FK блокує донат на донора, не приєднаного до org.

## Релевантні файли

- `apps/server/src/db/schema/donations.ts` (новий)
- [`apps/server/src/db/schema/index.ts`](../../../apps/server/src/db/schema/index.ts), [`relations.ts`](../../../apps/server/src/db/schema/relations.ts), [`enums.ts`](../../../apps/server/src/db/schema/enums.ts)
