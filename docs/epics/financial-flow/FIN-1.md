---
id: FIN-1
epic: financial-flow
phase: 0
type: feat
status: todo
depends_on: []
parallelizable: false
branch: feat/fin-1-shared-financial-contracts
pr:
---

# FIN-1 — Shared financial contracts

**Епік:** [financial-flow](../financial-flow.md) · **Фаза 0** · **Залежності:** — (Vehicle Status Flow завершено)

## Мета

Зафіксувати shared-типи донату, донора, журналу і summary — фундамент, на якому будується весь епік.

## Обсяг

- Zod-схеми `DonationCreate` / `DonationUpdate` / `DonationResponse` і `DonorResponse` у `packages/shared`.
- `DonationCreate` — **strict union** за способом вибору донора: рівно одне з `donorId` / `newDonorName` (XOR); `organizationId` не приймається; `vehicleId` обов'язковий, `categoryId` optional (розд. 7.1).
- `FinancialEntry` — **strict discriminated union за `type`** (`expense | donation`); `category`/`donor` мають точні типи у відповідній гілці; `documentCount` лише у гілці `expense` (розд. 7.3).
- Signed-поля (`signedAmount`, `signedAmountUah`) існують **тільки в response**, не в request.
- Filters/summary schemas для `/financial-entries` (`byCurrency` breakdown — розд. 4.2).
- Спільний `FinancialCategory` (заміна expense-category contract).
- Прибрати funding source з expense contracts; зробити `vehicleId` **обов'язковим** у expense contracts.
- Усі грошові поля — integer у **мінорних одиницях** із суфіксом `Minor` (`amountMinor`, `amountUahMinor`, `signedAmountMinor`, `signedAmountUahMinor`; summary `*UahMinor`; byCurrency `*Minor`); Zod `.int().positive()` для request; спільний branded `MinorAmount`. `rate` лишається `number` (розд. 3 п.17, 4.1).
- Unit-тести XOR-валідації донора і discriminated union (відхиляє поля іншої гілки, не мовчки видаляє).

## Критерії приймання

- XOR `donorId/newDonorName` валідується; signed fields лише response; expense `vehicleId` required.
- Грошові поля — `.int()` мінорні одиниці з суфіксом `Minor`; `rate` — number.
- `FinancialEntry` union відхиляє поля іншого типу; `pnpm -w typecheck` зелений.

## Релевантні файли

- `packages/shared/src/schemas/donation.ts`, `donor.ts`, `financial-entry.ts` (нові)
- [`packages/shared/src/schemas/expense.ts`](../../../packages/shared/src/schemas/expense.ts), [`dictionary.ts`](../../../packages/shared/src/schemas/dictionary.ts), [`schemas/index.ts`](../../../packages/shared/src/schemas/index.ts)
- [`packages/shared/src/constants/routes.ts`](../../../packages/shared/src/constants/routes.ts)
