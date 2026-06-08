---
id: ORG-6
epic: organizations-multitenancy
phase: 1
type: feat
status: done
depends_on: [ORG-5]
parallelizable: false
branch: feat/ORG-6
pr:
---

# ORG-6 — Контекст тенанта: `orgScope` + same-org валідація

**Епік:** [organizations-multitenancy](../organizations-multitenancy.md) · **Фаза 1** · **Залежності:** ORG-5

## Мета

Централізований шар скоупінгу, на який спираються всі сервіси Фази 2. Без нього кожен модуль писав би
org-фільтр вручну (ризик IDOR).

## Обсяг

- Request-scoped провайдер активної організації (читає `activeOrgId`/`orgRole` з токена).
- `orgScope`-хелпер — Drizzle-умови `eq(table.organizationId, orgId)` per tenant-таблиця.
- Утиліта «сутність належить активній org» (для by-id → 404, не 403).
- Утиліта same-org валідації крос-зв'язків (expense↔vehicle, document↔vehicle/expense).

## Критерії приймання

- Юніт-тести хелпера й утиліт.
- Сервіси можуть інжектити контекст активної org.
- Інваріанти 1–5 (розд. 7 епіку) покриті на рівні утиліт.

## Релевантні файли

- `apps/server/src/common/` (новий tenant-context провайдер + `orgScope` хелпер + утиліти)
- [`apps/server/src/db/`](../../../apps/server/src/db/) — за потреби інтеграція з `db`
