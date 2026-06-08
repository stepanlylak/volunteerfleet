---
id: VSF-2
epic: vehicle-status-flow
phase: 0
type: feat
status: todo
depends_on: [VSF-1]
parallelizable: true
branch: feat/vsf-2-document-type-enum
pr:
---

# VSF-2 — Enum `document_type` + розширення `documents`

**Епік:** [vehicle-status-flow](../vehicle-status-flow.md) · **Фаза 0** · **Залежності:** VSF-1 (паралельно з VSF-3)

## Мета

Типізувати документи, щоб переходи могли посилатися на конкретний тип документа.

## Обсяг

- Postgres enum `document_type` у Drizzle-схемі: `registration_certificate, customs_declaration, stamped_customs_declaration, transfer_act_draft, transfer_act_signed, return_act, other`.
- Колонка `document_type document_type NOT NULL DEFAULT 'other'` на `documents`.
- Оновити shared-типи документів і create/upload/link/update schemas (додати `document_type`, default `other`).

## Критерії приймання

- Документи мають тип; існуючий CRUD працює з `document_type = other` за замовчуванням.
- `pnpm -w typecheck` зелений.

## Релевантні файли

- [`apps/server/src/db/schema/enums.ts`](../../../apps/server/src/db/schema/enums.ts), [`documents.ts`](../../../apps/server/src/db/schema/documents.ts)
- [`packages/shared/src/schemas/document.ts`](../../../packages/shared/src/schemas/document.ts)
- [`apps/server/src/modules/documents/documents.service.ts`](../../../apps/server/src/modules/documents/documents.service.ts), [`documents.controller.ts`](../../../apps/server/src/modules/documents/documents.controller.ts)
