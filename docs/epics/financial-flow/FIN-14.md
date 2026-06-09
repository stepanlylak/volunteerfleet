---
id: FIN-14
epic: financial-flow
phase: 2
type: feat
status: todo
depends_on: [FIN-13]
parallelizable: false
branch: feat/fin-14-vehicle-finance-tab
pr:
---

# FIN-14 — Finance tab у картці авто

**Епік:** [financial-flow](../financial-flow.md) · **Фаза 2** · **Залежності:** FIN-13

## Мета

Показати витрати, донати і баланс конкретного авто в одному місці.

## Обсяг

- Перейменувати вкладку «Витрати» → «Фінанси»; використати unified journal з `vehicleId` (розд. 8.5).
- Відобразити витрати авто, донати, прямо прив'язані до авто, баланс авто; обидві create actions з preselected vehicle.
- На переході `→ paid` запропонувати створення **prefilled-витрати** «Купівля авто» (vehicle, дата, сума/валюта/курс) — звичайна expense row, без каскаду зі статусом (розд. 11).

## Критерії приймання

- Відображаються лише прямо пов'язані з авто записи; створений з картки донат автоматично отримує це `vehicleId`.
- З paid-переходу можна одним кроком створити витрату купівлі, і вона з'являється у балансі авто.

## Релевантні файли

- [`apps/client/src/pages/vehicles/VehicleCardPage.tsx`](../../../apps/client/src/pages/vehicles/VehicleCardPage.tsx)
- `apps/client/src/modals/StatusTransitionModal.tsx` (VSF, точка інтеграції prefilled-витрати)
