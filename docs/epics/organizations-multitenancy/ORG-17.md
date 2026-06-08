---
id: ORG-17
epic: organizations-multitenancy
phase: 4
type: feat
status: todo
depends_on: [ORG-14]
parallelizable: true
branch:
pr:
---

# ORG-17 — Активна org на сторінках даних + empty-states

**Епік:** [organizations-multitenancy](../organizations-multitenancy.md) · **Фаза 4** · **Залежності:**
ORG-14 (паралельно з ORG-15/16)

## Мета

Узгодити сторінки даних із контекстом активної org і коректно показати граничні стани.

## Обсяг

- Переконатися, що списки/картки/звіти працюють у контексті активної org (бекенд уже скоупить — прибрати
  будь-які крос-org припущення на фронті).
- Empty-states: `user` без жодної org та `superuser` без активної org.
- Приховати мутаційні дії за `orgRole` (viewer — без кнопок створення/редагування/видалення).

## Критерії приймання

- Користувач без org бачить зрозумілий empty-state.
- viewer не бачить мутаційних дій.

## Релевантні файли

- [`VehiclesListPage.tsx`](../../../apps/client/src/pages/vehicles/VehiclesListPage.tsx), [`VehicleCardPage.tsx`](../../../apps/client/src/pages/vehicles/VehicleCardPage.tsx), [`ExpensesListPage.tsx`](../../../apps/client/src/pages/expenses/ExpensesListPage.tsx)
- [`DashboardPage.tsx`](../../../apps/client/src/pages/dashboard/DashboardPage.tsx), reports-сторінки
