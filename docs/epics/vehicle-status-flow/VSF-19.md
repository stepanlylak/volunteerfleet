---
id: VSF-19
epic: vehicle-status-flow
phase: 2
type: feat
status: todo
depends_on: [VSF-8, VSF-10, VSF-11, VSF-20]
parallelizable: false
branch: feat/vsf-19-alerts-in-history
pr:
---

# VSF-19 — Переосмислення алертів: прив'язка до запису історії (опційна)

**Епік:** [vehicle-status-flow](../vehicle-status-flow.md) · **Фаза 2** · **Залежності:** VSF-8, VSF-10, VSF-11, VSF-20

## Мета

Переробити модель і подачу алертів так, щоб:

1. Кожен алерт обчислювався **під конкретний запис історії** і мав пряму прив'язку до
   `vehicle_status_history.id`, а не через мапінг «тип алерту → статус».
2. Прив'язка була **опційною (nullable)** — щоб у майбутньому додавати алерти, не пов'язані зі
   статусом (напр. відсутнє фото авто, мінусовий баланс по збору на авто), без прив'язки до історії.
3. Алерти відображались у деталях відповідного запису історії статусів, а не блоком зверху картки
   ([VSF-10](VSF-10.md)). Кількість алертів — у назві вкладки «Історія статусів» та колонкою у
   списку авто.

## Модель алертів

- **Пряма прив'язка по id, без type→status-конфігу.** View обчислює кожен алерт відносно
  конкретного рядка `vehicle_status_history` (де поле/документ мають бути й відсутні) і повертає
  цей `vehicle_status_history_id`. Жодної таблиці «тип → статус» у коді — зв'язок завжди по id.
- **`vehicle_status_history_id` — nullable.** Статус-залежні алерти лінкуються до свого рядка
  історії; майбутні не-статусні алерти повертають `NULL` (vehicle-level). Конкретні не-статусні
  типи — поза цим тікетом; тут лише закладаємо опційність зв'язку.
- **Slim-принцип зберігається.** View повертає `(vehicle_id, type, vehicle_status_history_id)`;
  UA-текст лишається в `VEHICLE_ALERT_CONFIG` (`packages/shared`), у БД текстів немає.
- **Цикли.** Для повторюваних статусів (`transferred`/`returned`/`in_repair`) алерт лінкується до
  актуального (останнього) рядка відповідного статусу — як уже реалізовано у View.

## Обсяг

- **Backend (View):** переписати `vehicle_alerts_view` з `(vehicle_id, type)` на
  `(vehicle_id, type, vehicle_status_history_id)`, де кожен предикат повертає id конкретного рядка
  історії (для не-статусних алертів у майбутньому — `NULL`). Редагуємо існуючу міграцію
  `apps/server/drizzle/0001_vehicle_alerts_view.sql` (БД перестворюється з нуля).
- **Shared:** `vehicleAlertSchema` отримує `vehicleStatusHistoryId: string | null`.
- **Backend (service):** `VehicleAlertService` мапить нове поле у `VehicleAlert`.
  `VehicleResponse.alerts` уже повертається і в деталях, і per-row у списку — каунт = `alerts.length`.
- **Frontend (історія):** у таймлайні ([VSF-11](VSF-11.md)) під кожним записом рендерити алерти, чий
  `vehicleStatusHistoryId` збігається (Ant Design `Alert` type="warning"). Алерти з `null`-прив'язкою
  у цьому тікеті не виникають; місце їх показу визначимо разом із першим не-статусним алертом.
- **Frontend (вкладка):** каунт `(N)` у назві вкладки «Історія статусів», якщо `N > 0`.
- **Frontend (список):** замінити іконку-індикатор на колонку/бейдж із кількістю у
  `VehiclesListPage.tsx`; фільтр «З алертами» (`hasAlerts`) лишається.
- **Frontend (картка):** прибрати блок `Alert` зверху `VehicleCardPage.tsx`; жодного зведеного
  індикатора поза вкладкою історії.
- **Док:** оновити розд. 5 `vehicle-status-flow.md` (View повертає `vehicle_status_history_id`,
  опційність зв'язку, відмова від type→status) і тікети VSF-10/VSF-11.

## Критерії приймання

- Кожен статус-залежний алерт показується в деталях саме того запису історії, до якого прив'язаний.
- View повертає `vehicle_status_history_id`; поле nullable; для циклів — актуальний рядок статусу.
- Каунт алертів видно в назві вкладки і в списку; фільтр `hasAlerts` працює; блоку зверху картки немає.
- Алерти інформативні (`warning`), нічого не блокують.

## Інваріанти

View не повертає алерти для soft-deleted авто/документів; усі зв'язки org-scoped.

## Залежності-уточнення

- Поле `registrationDocId` фігурує і на `→ paid`, і на `→ arrived` — це розщеплюється на окремі
  поля у [VSF-20](VSF-20.md). Алерт(и) техпаспорта лінкуються до відповідних рядків уже після VSF-20.

## Релевантні файли

- [`apps/server/src/db/schema/vehicle-alerts-view.ts`](../../../apps/server/src/db/schema/vehicle-alerts-view.ts), `apps/server/drizzle/0001_vehicle_alerts_view.sql`
- [`apps/server/src/modules/vehicles/vehicle-alert.service.ts`](../../../apps/server/src/modules/vehicles/vehicle-alert.service.ts)
- [`packages/shared/src/schemas/vehicle-status.ts`](../../../packages/shared/src/schemas/vehicle-status.ts) (`vehicleAlertSchema`, `VEHICLE_ALERT_CONFIG`)
- [`apps/client/src/pages/vehicles/VehicleCardPage.tsx`](../../../apps/client/src/pages/vehicles/VehicleCardPage.tsx) (історія + видалення блоку зверху)
- [`apps/client/src/pages/vehicles/VehiclesListPage.tsx`](../../../apps/client/src/pages/vehicles/VehiclesListPage.tsx)
- `apps/client/src/components/` (компонент таймлайну історії)
