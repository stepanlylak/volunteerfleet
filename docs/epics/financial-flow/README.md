# Тікети епіку: Financial Flow (фінансовий флоу витрат і донатів)

Декомпозиція епіку [financial-flow.md](../financial-flow.md) на робочі тікети.
Кожен файл `FIN-*.md` — самодостатній опис однієї задачі. **Ці md-тікети грають роль issue для епіку**
(зовнішнього трекера/Jira не використовуємо).

> Повний контекст, зафіксовані рішення, фінансова модель, модель донорів і схема БД — в [епіку](../financial-flow.md).
> Агентний процес (статуси, життєвий цикл тікета) — у [agent-workflow.md](../../agent-workflow.md);
> загальні git/PR/commit-конвенції — у [contributing.md](../../contributing.md). Тут лише те, що
> специфічне для роботи з цими тікетами.

## Процес

Статуси (`todo → ready → done`) і життєвий цикл тікета — у загальному
[agent-workflow.md](../../agent-workflow.md). Тут — лише епік-специфіка.

> Дотримуйтесь **наскрізних інваріантів** (розд. 10 епіку) у кожному бекенд-тікеті: `organization_id`
> з контексту (не з body), `404` (не `403`) на чужу org, same-org для крос-зв'язків, donor list лише
> через `organization_donors`, обидві гілки journal-union фільтруються за active org, signed amount
> визначає сервер, soft-deleted записи не входять у summary.

## Передумова

Епік виконується **після** завершення [vehicle-status-flow](../vehicle-status-flow.md) (а отже й
[organizations-multitenancy](../organizations-multitenancy.md)): використовуються фінальна enum-модель
статусів, `orgScope`, `@OrgRoles`, `organization_id` на сутностях і спільний money/currency/rate
компонент із VSF.

> **Без живих даних на проді.** Міграції доводяться до фінального стану при імплементації, БД
> перестворюється — backfill не потрібен (розд. 11–12 епіку).
>
> **Гроші — цілі мінорні одиниці (копійки/центи).** Усі грошові колонки/поля — `bigint`/integer ×100
> із суфіксом `Minor`; `rate` лишається `numeric(14,6)`. Конвертація наявного коду — [FIN-17](FIN-17.md);
> нові сутності пишуться в мінорних одиницях одразу (розд. 3 п.17, 4.1 епіку).

## Індекс

| #                   | Назва                                                         | Фаза | Залежності            | Статус |
| ------------------- | ------------------------------------------------------------- | :--: | --------------------- | ------ |
| [FIN-1](FIN-1.md)   | Shared financial contracts                                    |  0   | —                     | done   |
| [FIN-17](FIN-17.md) | Гроші як цілі мінорні одиниці (центи/копійки)                 |  0   | FIN-1                 | done   |
| [FIN-2](FIN-2.md)   | Схема `donors` + `organization_donors`                        |  0   | FIN-1                 | done   |
| [FIN-3](FIN-3.md)   | Схема `donations`                                             |  0   | FIN-2                 | done   |
| [FIN-4](FIN-4.md)   | `financial_categories`, видалення `funding_sources`, міграція |  0   | FIN-2, FIN-3          | ready  |
| [FIN-5](FIN-5.md)   | Donors API                                                    |  1   | FIN-4                 | todo   |
| [FIN-6](FIN-6.md)   | Donations CRUD                                                |  1   | FIN-5                 | todo   |
| [FIN-7](FIN-7.md)   | Expense flow без funding source                               |  1   | FIN-4                 | todo   |
| [FIN-8](FIN-8.md)   | Unified financial journal і balance                           |  1   | FIN-6, FIN-7          | todo   |
| [FIN-9](FIN-9.md)   | Cleanup старих reports + reporting-ready queries              |  1   | FIN-8                 | todo   |
| [FIN-10](FIN-10.md) | Reusable money fields                                         |  2   | FIN-6, FIN-7          | todo   |
| [FIN-11](FIN-11.md) | Donor picker і сторінка донорів                               |  2   | FIN-5                 | todo   |
| [FIN-12](FIN-12.md) | Donation form                                                 |  2   | FIN-6, FIN-10, FIN-11 | todo   |
| [FIN-13](FIN-13.md) | Finance page                                                  |  2   | FIN-8, FIN-12         | todo   |
| [FIN-14](FIN-14.md) | Finance tab у картці авто                                     |  2   | FIN-13                | todo   |
| [FIN-15](FIN-15.md) | Document details modal                                        |  2   | FIN-7                 | todo   |
| [FIN-16](FIN-16.md) | Наскрізні тести і документація                                |  3   | FIN-9, FIN-14, FIN-15 | todo   |

## Критичний шлях

FIN-1 → FIN-17 → FIN-2 → FIN-3 → FIN-4 → FIN-5 → FIN-6 → FIN-8 → FIN-13 → FIN-14 → FIN-16.

## Можна паралелити

- FIN-17 — після FIN-1; чіпає `expenses` разом із FIN-4, тож міграції координуються.
- FIN-3 і (частина) FIN-4 спираються на FIN-2; FIN-7 паралельний до FIN-5/FIN-6 (обидва після FIN-4).
- FIN-9 — після FIN-8.
- FIN-11 — після FIN-5, паралельно з backend donations.
- FIN-15 — після FIN-7, паралельно з donation backend і FIN-13.
- FIN-10 додатково залежить від VSF-money-component тікета ([VSF-9](../vehicle-status-flow/VSF-9.md)).
- FIN-16 — наскрізна регресія + docs наприкінці.
