# Тікети епіку: Organizations (мультитенантність)

Декомпозиція епіку [organizations-multitenancy.md](../organizations-multitenancy.md) на робочі тікети.
Кожен файл `ORG-*.md` — самодостатній опис однієї задачі. **Ці md-тікети грають роль issue для епіку**
(зовнішнього трекера/Jira не використовуємо).

> Повний контекст, зафіксовані рішення, модель даних і наскрізні інваріанти — в [епіку](../organizations-multitenancy.md).
> Загальний git/PR/commit-воркфлоу — у [contributing.md](../../contributing.md). Тут лише те, що
> специфічне для роботи з цими тікетами.

## Статуси

У frontmatter кожного тікета поле `status`:

| Статус        | Значення                                    |
| ------------- | ------------------------------------------- |
| `todo`        | не розпочато                                |
| `in-progress` | в роботі (є гілка)                          |
| `in-review`   | відкрито PR, чекає рев'ю/CI                 |
| `done`        | PR змерджено                                |
| `blocked`     | заблоковано (вкажіть причину в тілі тікета) |

## Як брати тікет у роботу

1. **Обрати** тікет, у якого всі `depends_on` уже `done` (див. таблицю нижче).
2. `git fetch origin` → відгалузити від `main` гілку `<type>/org-<n>-<slug>`
   (напр. `feat/org-5-jwt-active-org`). `type` — з frontmatter тікета.
3. У тікеті виставити `status: in-progress` і заповнити `branch:`.
4. Реалізувати за розділом **Обсяг**; виконати **Критерії приймання** + загальний PR-чекліст із
   [contributing.md](../../contributing.md) (`pnpm lint`, `typecheck`, `test`; міграції; docs).
5. Відкрити PR (заголовок — Conventional Commits, напр. `feat(auth): add active-org JWT and switch-org`).
   У тікеті — `status: in-review`, заповнити `pr:`. В описі PR послатися на тікет.
6. Після merge — `status: done`.

> Дотримуйтесь **наскрізних інваріантів** (розд. 7 епіку) у кожному бекенд-тікеті: org-скоуп у кожному
> запиті, 404 (не 403) на чужу org, `organization_id` з контексту, same-org для крос-зв'язків, лише
> `orgScope`, жодних state-changing GET.

## Індекс

| #                   | Назва                                                | Фаза | Залежності          | Статус |
| ------------------- | ---------------------------------------------------- | :--: | ------------------- | ------ |
| [ORG-1](ORG-1.md)   | Схема: organizations та organization_members         |  0   | —                   | todo   |
| [ORG-2](ORG-2.md)   | Схема tenant-таблиць: org_id, drop slug, last_active |  0   | ORG-1               | todo   |
| [ORG-3](ORG-3.md)   | Reset міграцій і сіди (greenfield)                   |  0   | ORG-1, ORG-2, ORG-4 | todo   |
| [ORG-4](ORG-4.md)   | Рефактор ролей і гарди                               |  0   | ORG-1               | todo   |
| [ORG-5](ORG-5.md)   | JWT активної org + cookie-only + switch-org          |  1   | ORG-1, ORG-3, ORG-4 | todo   |
| [ORG-6](ORG-6.md)   | Контекст тенанта: orgScope + same-org валідація      |  1   | ORG-5               | todo   |
| [ORG-7](ORG-7.md)   | Скоуп vehicles (+ photos, status history)            |  2   | ORG-6               | todo   |
| [ORG-8](ORG-8.md)   | Скоуп expenses + same-org валідація                  |  2   | ORG-6               | todo   |
| [ORG-9](ORG-9.md)   | Скоуп documents + same-org валідація                 |  2   | ORG-6               | todo   |
| [ORG-10](ORG-10.md) | Скоуп dashboard і reports                            |  2   | ORG-6               | todo   |
| [ORG-11](ORG-11.md) | Публічні сторінки /public/:orgId/\*                  |  2   | ORG-6, ORG-10       | todo   |
| [ORG-12](ORG-12.md) | API організацій (платформний superuser)              |  3   | ORG-4, ORG-5        | todo   |
| [ORG-13](ORG-13.md) | API учасників (coordinator)                          |  3   | ORG-4, ORG-5        | todo   |
| [ORG-14](ORG-14.md) | Auth-стор (cookie-only) + перемикач org              |  4   | ORG-5               | todo   |
| [ORG-15](ORG-15.md) | Платформні сторінки організацій                      |  4   | ORG-12, ORG-14      | todo   |
| [ORG-16](ORG-16.md) | Налаштування організації (coordinator)               |  4   | ORG-13, ORG-14      | todo   |
| [ORG-17](ORG-17.md) | Активна org на сторінках даних + empty-states        |  4   | ORG-14              | todo   |
| [ORG-18](ORG-18.md) | Тести                                                |  5   | Фази 2–4            | todo   |
| [ORG-19](ORG-19.md) | Документація                                         |  5   | Фази 0–4            | todo   |
