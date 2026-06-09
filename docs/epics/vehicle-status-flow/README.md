# Тікети епіку: Vehicle Status Flow (флов статусів авто)

Декомпозиція епіку [vehicle-status-flow.md](../vehicle-status-flow.md) на робочі тікети.
Кожен файл `VSF-*.md` — самодостатній опис однієї задачі. **Ці md-тікети грають роль issue для епіку**
(зовнішнього трекера/Jira не використовуємо).

> Повний контекст, зафіксовані рішення, модель даних, матриця переходів і логіка алертів — в [епіку](../vehicle-status-flow.md).
> Агентний процес (статуси, життєвий цикл тікета) — у [agent-workflow.md](../../agent-workflow.md);
> загальні git/PR/commit-конвенції — у [contributing.md](../../contributing.md). Тут лише те, що
> специфічне для роботи з цими тікетами.

## Процес

Статуси (`todo → ready → done`) і життєвий цикл тікета — у загальному
[agent-workflow.md](../../agent-workflow.md). Тут — лише епік-специфіка.

> Дотримуйтесь **наскрізних інваріантів** org-епіку у кожному бекенд-тікеті: org-скоуп у кожному
> запиті, 404 (не 403) на чужу org, `organization_id` з контексту, same-org для крос-зв'язків, лише
> `orgScope`, жодних state-changing GET. Додатково для цього епіку: переходи/rollback/edit —
> конкурентно безпечні (row lock / compare-and-swap, `409` на конфлікт).

## Передумова

Епік виконується **після** завершення [organizations-multitenancy](../organizations-multitenancy.md)
(використовуються `orgScope`, `@OrgRoles`, `organization_id` на сутностях).

## Індекс

| #                   | Назва                                                   | Фаза | Залежності          | Статус |
| ------------------- | ------------------------------------------------------- | :--: | ------------------- | ------ |
| [VSF-1](VSF-1.md)   | Enum `vehicle_status` + константи + shared-типи         |  0   | —                   | done   |
| [VSF-2](VSF-2.md)   | Enum `document_type` + розширення `documents`           |  0   | VSF-1               | done   |
| [VSF-3](VSF-3.md)   | Міграція `vehicles`: `statusId` → enum (+ `start_date`) |  0   | VSF-1               | done   |
| [VSF-4](VSF-4.md)   | Розширення `vehicle_status_history`                     |  0   | VSF-1, VSF-2, VSF-3 | done   |
| [VSF-5](VSF-5.md)   | Видалення `vehicle_statuses` + перевід споживачів       |  0   | VSF-3, VSF-4        | done   |
| [VSF-17](VSF-17.md) | Консолідація міграцій + чистка seed                     |  0   | VSF-5               | done   |
| [VSF-6](VSF-6.md)   | Ендпоінт `POST /vehicles/:id/transition`                |  1   | VSF-5               | done   |
| [VSF-7](VSF-7.md)   | Авто `new` + прибрати `statusId` з create/update        |  1   | VSF-6               | done   |
| [VSF-8](VSF-8.md)   | Обчислення алертів (slim-View)                          |  1   | VSF-6               | ready  |
| [VSF-15](VSF-15.md) | Видалення останнього статусу (Rollback)                 |  1   | VSF-6               | ready  |
| [VSF-16](VSF-16.md) | Редагування даних переходу                              |  1   | VSF-6               | ready  |
| [VSF-9](VSF-9.md)   | Модалка переходу статусу                                |  2   | VSF-6, VSF-7        | ready  |
| [VSF-10](VSF-10.md) | Алерти на картці авто                                   |  2   | VSF-8, VSF-9        | todo   |
| [VSF-11](VSF-11.md) | Покращена історія статусів                              |  2   | VSF-9, VSF-16       | todo   |
| [VSF-12](VSF-12.md) | Оновлення фільтрів, форм і довідників                   |  2   | VSF-9               | todo   |
| [VSF-13](VSF-13.md) | Тести (наскрізна регресія)                              |  3   | Фази 0–2            | todo   |
| [VSF-14](VSF-14.md) | Документація                                            |  3   | Фази 0–2            | todo   |

## Критичний шлях

VSF-1 → VSF-3 → VSF-4 → VSF-5 → VSF-17 → VSF-6 → VSF-7 → VSF-8 → VSF-9 → (решта).

## Можна паралелити

- VSF-2 і VSF-3 — після VSF-1.
- VSF-7, VSF-8, VSF-15, VSF-16 — після VSF-6.
- VSF-10 і VSF-12 — після VSF-9; VSF-11 додатково залежить від VSF-16.
- VSF-13 і VSF-14 — паралельно.
