---
id: VSF-9
epic: vehicle-status-flow
phase: 2
type: feat
status: done
depends_on: [VSF-6, VSF-7]
parallelizable: false
branch: feat/vsf-9-10-status-transition
pr:
---

# VSF-9 — Модалка переходу статусу

**Епік:** [vehicle-status-flow](../vehicle-status-flow.md) · **Фаза 2** · **Залежності:** VSF-6, VSF-7

## Мета

UI для зміни статусу з динамічною формою, специфічною для обраного переходу.

## Обсяг

- `StatusTransitionModal`: показує лише дозволені наступні статуси (з матриці); динамічні поля залежно від обраного статусу.
- Документи — переюз уніфікованої компоненти `FileAttachmentField` (та сама, що у формі витрати) **по одному інстансу на документний слот** (`multiple={false}`): переходи `→ paid`/`→ arrived` мають 2 слоти → 2 окремі поля, кожне зі своїм `document_type` і `docId`. Без додаткового функціоналу «який файл за що» — слот сам визначає тип.
- Кожне поле: «завантажити новий» або «прикріпити наявний» (upload-then-reference: спершу `POST /documents/upload` з `vehicleId` + `document_type`, потім `transition` з `docId`).
- Поле дати переходу (default = дата попереднього переходу).
- Кнопка «Змінити статус» на картці авто.
- Винести amount/currency/rate/rateSource у перевикористовуваний компонент і застосувати його також у формі витрати.

## Критерії приймання

- Перехід працює end-to-end; нові й наявні документи прикріплюються з правильним `document_type`.
- Поля відповідають специфікації; дата за замовчуванням правильна.

## Релевантні файли

- `apps/client/src/modals/StatusTransitionModal.tsx` (новий)
- [`apps/client/src/components/files/FileAttachmentField.tsx`](../../../apps/client/src/components/files/FileAttachmentField.tsx)
- [`apps/client/src/modals/ExpenseFormModal.tsx`](../../../apps/client/src/modals/ExpenseFormModal.tsx) (спільний amount/currency/rate компонент)
- [`apps/client/src/pages/vehicles/VehicleCardPage.tsx`](../../../apps/client/src/pages/vehicles/VehicleCardPage.tsx)
