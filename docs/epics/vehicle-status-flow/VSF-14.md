---
id: VSF-14
epic: vehicle-status-flow
phase: 3
type: docs
status: todo
depends_on: [VSF-5, VSF-6, VSF-8]
parallelizable: true
branch: docs/vsf-14-update-project-docs
pr:
---

# VSF-14 — Документація

**Епік:** [vehicle-status-flow](../vehicle-status-flow.md) · **Фаза 3** · **Залежності:** Фази 0–2 (паралельно з VSF-13)

## Мета

Оновити проєктну документацію відповідно до фактичної моделі статус-флову.

## Обсяг

- `database.md`: нові enum'и (`vehicle_status`, `document_type`), зміни таблиць (`vehicles`, `vehicle_status_history`, `documents`), View `vehicle_alerts_view`.
- `overview.md`: секція vehicle status flow (матриця переходів, алерти).
- Оновити API-документацію (нові transition/rollback/edit ендпоінти).

## Критерії приймання

- Документи відображають фактичну модель і API.

## Релевантні файли

- `docs/database.md`, `docs/overview.md`
- API-документація (OpenAPI/Swagger генерується із Zod-схем)
