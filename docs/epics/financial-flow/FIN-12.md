---
id: FIN-12
epic: financial-flow
phase: 2
type: feat
status: todo
depends_on: [FIN-6, FIN-10, FIN-11]
parallelizable: false
branch: feat/fin-12-donation-form
pr:
---

# FIN-12 — Donation form

**Епік:** [financial-flow](../financial-flow.md) · **Фаза 2** · **Залежності:** FIN-6, FIN-10, FIN-11

## Мета

Додавати надходження з finance page і картки авто.

## Обсяг

- `DonationFormModal` (розд. 8.3): дата, money fields (FIN-10), optional фінансова категорія/призначення, donor picker (FIN-11), **обов'язковий** автомобіль, optional опис.
- Vehicle preselection (коли відкрито з картки авто).
- Edit flow (PATCH) з урахуванням ADR-010 (курс не перераховується автоматично).

## Критерії приймання

- Донат з existing / new / exact-ID donor створюється end-to-end.
- Vehicle обов'язковий; preselection працює; edit зберігає історичний курс.

## Релевантні файли

- `apps/client/src/modals/DonationFormModal.tsx` (новий)
- `apps/client/src/api/donations.api.ts`, `hooks/useDonations.ts` (нові)
- `apps/client/src/components/MoneyFields.tsx`, `components/DonorPicker.tsx`
