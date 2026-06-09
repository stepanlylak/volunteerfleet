---
id: VSF-4
epic: vehicle-status-flow
phase: 0
type: feat
status: done
depends_on: [VSF-1, VSF-2, VSF-3]
parallelizable: false
branch: feat/vsf-4-status-history-extend
pr:
---

# VSF-4 — Розширення `vehicle_status_history`

**Епік:** [vehicle-status-flow](../vehicle-status-flow.md) · **Фаза 0** · **Залежності:** VSF-1, VSF-2, VSF-3

## Мета

Зберігати додаткові дані кожного переходу (ціна, документи, чекбокси, дата) безпосередньо в історії.

## Обсяг

- Замінити `old_status_id`/`new_status_id` (uuid FK) на `old_status vehicle_status NULL` / `new_status vehicle_status NOT NULL`.
- Додати nullable-колонки (розд. 6 епіку): `purchase_price`, `purchase_currency`, `purchase_rate`, `purchase_rate_source`, `is_local_purchase`, `repair_note`, `is_registered_at_service_center`, `lost_reason`, `transition_date date NOT NULL DEFAULT CURRENT_DATE`.
- Document FK (всі `ON DELETE RESTRICT`): `registration_doc_id`, `customs_declaration_doc_id`, `stamped_customs_declaration_doc_id`, `transfer_act_draft_doc_id`, `transfer_act_signed_doc_id`, `return_act_doc_id` → `documents.id`.
- DB checks для узгодженості валютної групи (`purchase_*` — або всі присутні, або всі NULL; для UAH `rate = 1`).
- Partial unique index `UNIQUE (vehicle_id) WHERE new_status = 'paid'`.
- Оновити shared-типи та Zod-схеми історії.

## Критерії приймання

- Схема відповідає розд. 6; `transition_date` відмінний від системного `changed_at`.
- `pnpm -w typecheck` зелений.

## Релевантні файли

- [`apps/server/src/db/schema/vehicle-status-history.ts`](../../../apps/server/src/db/schema/vehicle-status-history.ts)
- [`packages/shared/src/schemas/vehicle.ts`](../../../packages/shared/src/schemas/vehicle.ts) (status history schema)
- [`apps/server/src/db/schema/relations.ts`](../../../apps/server/src/db/schema/relations.ts)
