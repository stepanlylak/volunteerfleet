---
id: FIN-5
epic: financial-flow
phase: 1
type: feat
status: done
branch: feat/fin-phase-1
depends_on: [FIN-4]
parallelizable: false
branch: feat/fin-5-donors-api
pr:
---

# FIN-5 — Donors API

**Епік:** [financial-flow](../financial-flow.md) · **Фаза 1** · **Залежності:** FIN-4

## Мета

Керувати org donor list без розкриття глобального каталогу донорів.

## Обсяг

- `DonorsModule` / Controller / Service (розд. 7.2): `GET /donors` (донори active org), `POST /donors` (створити + приєднати, транзакційно), `GET /donors/resolve/:id` (exact UUID → `id`, `name`, `alreadyLinked`), `POST /donors/link`, `DELETE /donors/:id/link` (деактивація).
- Ролі розд. 10: list/resolve/link — coordinator+volunteer; create — coordinator+volunteer; deactivate — coordinator. `organizationId` не приймається з body.
- Дублікат імені в межах active org → `409 DONOR_NAME_ALREADY_EXISTS` з мінімальним списком local matches; bypass через `allowDuplicateName = true` (розд. 5.1). Донори інших org у перевірку не потрапляють.
- `resolve` працює лише за **повним валідним UUID**; не повертає список org, донати, контакти чи пошук за частиною ID.

## Критерії приймання

- Org A не browse'ить donors org B; exact UUID можна приєднати; response не розкриває чужі org/донати.
- Дублікат-нейм у своїй org → 409 + можливість підтвердити тезку.

## Інваріанти

`organization_id` з контексту; `404` (не `403`) на чужий by-id; donor list завжди join через `organization_donors` (розд. 10).

## Релевантні файли

- `apps/server/src/modules/donors/*` (новий модуль)
- [`apps/server/src/common/utils/tenant.utils.ts`](../../../apps/server/src/common/utils/tenant.utils.ts)
- `packages/shared/src/schemas/donor.ts`
