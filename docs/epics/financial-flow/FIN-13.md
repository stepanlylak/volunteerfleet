---
id: FIN-13
epic: financial-flow
phase: 2
type: feat
status: todo
depends_on: [FIN-8, FIN-12]
parallelizable: false
branch: feat/fin-13-finance-page
pr:
---

# FIN-13 — Finance page

**Епік:** [financial-flow](../financial-flow.md) · **Фаза 2** · **Залежності:** FIN-8, FIN-12

## Мета

Замінити expenses-only сторінку єдиним фінансовим журналом.

## Обсяг

- Сторінка `/finances` (розд. 8.1): header KPI `Витрати` / `Донати` / `Баланс` (з підписом стану), кнопки «Додати витрату» і «Додати донат».
- Таблиця зі signed rows: червоне `-сума` для витрат, зелене `+сума` для донатів; колонки Дата/Тип/Сума/UAH/Авто/Деталі/Опис/Документи/Дії (розд. 8.1). `*Minor`-значення діляться на 100 через `formatCurrency` для відображення.
- Фільтри: усі/витрати/донати, авто, категорія, донор, валюта, період.
- Role-based controls (розд. 10): viewer без mutation-кнопок.
- `/expenses` → redirect на `/finances`; пункт меню «Витрати» → «Фінанси».

## Критерії приймання

- Можна фільтрувати all/expense/donation; balance оновлюється з фільтрами.
- Role-based controls коректні; redirect зі старого `/expenses` працює.

## Релевантні файли

- `apps/client/src/pages/finances/*` (новий)
- [`apps/client/src/pages/expenses/ExpensesListPage.tsx`](../../../apps/client/src/pages/expenses/ExpensesListPage.tsx) (мігрувати / redirect)
- [`apps/client/src/components/layout/AppLayout.tsx`](../../../apps/client/src/components/layout/AppLayout.tsx) (меню)
