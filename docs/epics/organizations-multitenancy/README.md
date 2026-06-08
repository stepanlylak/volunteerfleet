# Тікети епіку: Organizations (мультитенантність)

Декомпозиція епіку [organizations-multitenancy.md](../organizations-multitenancy.md) на робочі тікети.
Кожен файл `ORG-*.md` — самодостатній опис однієї задачі. **Ці md-тікети грають роль issue для епіку**
(зовнішнього трекера/Jira не використовуємо).

> Повний контекст, зафіксовані рішення, модель даних і наскрізні інваріанти — в [епіку](../organizations-multitenancy.md).
> Агентний процес (статуси, життєвий цикл тікета) — у [agent-workflow.md](../../agent-workflow.md);
> загальні git/PR/commit-конвенції — у [contributing.md](../../contributing.md). Тут лише те, що
> специфічне для роботи з цими тікетами.

## Процес

Статуси (`todo → ready → done`) і життєвий цикл тікета — у загальному
[agent-workflow.md](../../agent-workflow.md). Тут — лише епік-специфіка.

> Дотримуйтесь **наскрізних інваріантів** (розд. 7 епіку) у кожному бекенд-тікеті: org-скоуп у кожному
> запиті, 404 (не 403) на чужу org, `organization_id` з контексту, same-org для крос-зв'язків, лише
> `orgScope`, жодних state-changing GET.

## Індекс

| #                   | Назва                                                | Фаза | Залежності          | Статус |
| ------------------- | ---------------------------------------------------- | :--: | ------------------- | ------ |
| [ORG-1](ORG-1.md)   | Схема: organizations та organization_members         |  0   | —                   | done   |
| [ORG-2](ORG-2.md)   | Схема tenant-таблиць: org_id, drop slug, last_active |  0   | ORG-1               | done   |
| [ORG-3](ORG-3.md)   | Reset міграцій і сіди (greenfield)                   |  0   | ORG-1, ORG-2, ORG-4 | done   |
| [ORG-4](ORG-4.md)   | Рефактор ролей і гарди                               |  0   | ORG-1               | done   |
| [ORG-5](ORG-5.md)   | JWT активної org + cookie-only + switch-org          |  1   | ORG-1, ORG-3, ORG-4 | done   |
| [ORG-6](ORG-6.md)   | Контекст тенанта: orgScope + same-org валідація      |  1   | ORG-5               | done   |
| [ORG-7](ORG-7.md)   | Скоуп vehicles (+ photos, status history)            |  2   | ORG-6               | ready  |
| [ORG-8](ORG-8.md)   | Скоуп expenses + same-org валідація                  |  2   | ORG-6               | done   |
| [ORG-9](ORG-9.md)   | Скоуп documents + same-org валідація                 |  2   | ORG-6               | ready  |
| [ORG-10](ORG-10.md) | Скоуп dashboard і reports                            |  2   | ORG-6               | ready  |
| [ORG-11](ORG-11.md) | Публічні сторінки /public/:orgId/\*                  |  2   | ORG-6, ORG-10       | todo   |
| [ORG-12](ORG-12.md) | API організацій (платформний superuser)              |  3   | ORG-4, ORG-5        | ready  |
| [ORG-13](ORG-13.md) | API учасників (coordinator)                          |  3   | ORG-4, ORG-5        | ready  |
| [ORG-14](ORG-14.md) | Auth-стор (cookie-only) + перемикач org              |  4   | ORG-5               | ready  |
| [ORG-15](ORG-15.md) | Платформні сторінки організацій                      |  4   | ORG-12, ORG-14      | todo   |
| [ORG-16](ORG-16.md) | Налаштування організації (coordinator)               |  4   | ORG-13, ORG-14      | todo   |
| [ORG-17](ORG-17.md) | Активна org на сторінках даних + empty-states        |  4   | ORG-14              | todo   |
| [ORG-18](ORG-18.md) | Тести                                                |  5   | Фази 2–4            | todo   |
| [ORG-19](ORG-19.md) | Документація                                         |  5   | Фази 0–4            | todo   |
