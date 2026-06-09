---
id: BUG-2
epic: financial-flow
type: bug
status: todo
severity: medium
found_in: [FIN-8]
branch:
---

# BUG-2 — Journal/summary враховує донати видалених авто, а витрати — ні

**Епік:** [financial-flow](../../financial-flow.md) · **Знайдено в:** FIN-8 (unified financial journal)

Порушується наскрізний інваріант епіку (README розд. «Процес»): _«обидві гілки journal-union
фільтруються за active org … soft-deleted записи не входять у summary»_. Зараз гілки union
несиметричні щодо **soft-deleted авто**.

## Симптом

Авто видаляється м'яко (`vehicles.deletedAt`). Після цього:

- його **витрати** зникають із журналу, підсумків і списку витрат;
- його **донати** лишаються в журналі, підсумках і списку донатів.

Результат — спотворений баланс: для видаленого авто враховуються надходження, але не видатки.
Те саме видно в списках: `expenses.list` ховає записи видалених авто, `donations.list` — ні.

## Першопричина

### `apps/server/src/modules/financial-entries/financial-entries.service.ts` — `buildUnionCte`

```sql
-- гілка expense: join фільтрує видалені авто
FROM expenses e
INNER JOIN vehicles v ON v.id = e.vehicle_id AND v.deleted_at IS NULL
...

-- гілка donation: фільтра deleted_at НЕМАЄ
FROM donations d
INNER JOIN vehicles v ON v.id = d.vehicle_id
...
```

### Списки

- [`expenses.service.ts`](../../../../apps/server/src/modules/expenses/expenses.service.ts) — `list()`
  додає `hasJoinedActiveVehicle()` (`vehicles.deletedAt IS NULL`) при `!includeDeleted`.
- [`donations.service.ts`](../../../../apps/server/src/modules/donations/donations.service.ts) — `list()`
  взагалі не джойнить `vehicles` і не фільтрує за `deletedAt`.

> Зверніть увагу: `vehicles.softDelete` **не блокує** видалення авто з фінансовими записами (лише
> ставить `deletedAt`), тож ця ситуація досяжна штатно.

## Бажана поведінка

Обидві гілки union і обидва списки мають однаково ставитись до soft-deleted авто. Рекомендовано —
**виключати** записи видалених авто (як уже робить гілка expense), щоб виконати інваріант
«soft-deleted не входять у summary».

## Пропозиція виправлення

- У `buildUnionCte` додати `AND v.deleted_at IS NULL` у join гілки **donation** (дзеркально до expense).
- У `donations.service.list()` додати join `vehicles` + `isNull(vehicles.deletedAt)` при `!includeDeleted`
  (за зразком `expenses.service.list`), узгодивши `count` і вибірку сторінки.

> Альтернатива на розгляд: блокувати soft-delete авто, поки є непохерені витрати/донати. Але це ширша
> зміна продуктової поведінки — поза межами цього багу.

## Критерії приймання

- Після soft-delete авто його донати зникають із журналу, summary і `donations.list` (як і витрати).
- `balanceUahMinor` та `byCurrency` не враховують записів видалених авто.
- `includeDeleted`-режим (для coordinator) поведінку не ламає.

## Релевантні файли

- [`apps/server/src/modules/financial-entries/financial-entries.service.ts`](../../../../apps/server/src/modules/financial-entries/financial-entries.service.ts)
- [`apps/server/src/modules/donations/donations.service.ts`](../../../../apps/server/src/modules/donations/donations.service.ts)
- [`apps/server/src/modules/expenses/expenses.service.ts`](../../../../apps/server/src/modules/expenses/expenses.service.ts)
