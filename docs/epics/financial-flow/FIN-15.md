---
id: FIN-15
epic: financial-flow
phase: 2
type: feat
status: done
depends_on: [FIN-7]
parallelizable: true
branch: feat/financial-flow
pr:
---

# FIN-15 — Document details modal

**Епік:** [financial-flow](../financial-flow.md) · **Фаза 2** · **Залежності:** FIN-7 (паралельно з donation backend і FIN-13)

## Мета

Переглядати файли витрати без переходу на вкладку документів і зміни фільтрів.

## Обсяг

- Generic `DocumentDetailsModal` (розд. 9): клік на paperclip/count **не** змінює active tab і не ставить filters — відкриває modal зі списком документів витрати; один документ → одразу деталі, кілька → навігація всередині modal.
- Вміст: назва, `kind`, MIME, розмір, дата, ким додано, пов'язана витрата, preview, `Завантажити` / `Відкрити посилання`.
- Preview: `image/*` → AntD `Image`; `application/pdf` → sandboxed `iframe`/`object`; інші → placeholder + download. Зовнішні link-документи **не** вбудовуються (X-Frame-Options) — лише URL + кнопка.
- Розширити download contract: `GET /documents/:id/download?disposition=inline|attachment` (default `inline`; preview → inline; кнопка → attachment). orgScope/ролі не змінюються.
- Компонент generic — перевикористовний у вкладці документів.

## Критерії приймання

- Paperclip відкриває modal; image/PDF preview працює; unsupported type можна завантажити.
- Active tab і filters не змінюються; `disposition` коректно перемикає inline/attachment.

## Інваріанти

orgScope і ролі download незмінні (розд. 9.4).

## Релевантні файли

- `apps/server/src/modules/documents/documents.controller.ts`, `documents.service.ts`
- `apps/client/src/modals/DocumentDetailsModal.tsx` (новий)
- [`apps/client/src/pages/expenses/ExpensesListPage.tsx`](../../../apps/client/src/pages/expenses/ExpensesListPage.tsx) (прибрати старий tab/filter side effect)
