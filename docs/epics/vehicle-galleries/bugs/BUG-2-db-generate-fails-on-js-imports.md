---
id: BUG-2
epic: vehicle-galleries
type: bug
status: done
severity: medium
found_in: [GAL-2]
branch:
---

# BUG-2 — `pnpm db:generate` падав: drizzle-kit не резолвив `.js`-імпорти TS-схеми

**Епік:** [vehicle-galleries](../../vehicle-galleries.md) · **Знайдено в:** GAL-2 (та раніше, в
епіку organizations-multitenancy) · **Закрито 2026-06-10** — фікс уже в репо, верифіковано.

## Симптом (історичний)

```bash
drizzle-kit generate
# Cannot find module './enums.js'
#   requireStack: [ .../src/db/schema/index.ts, .../drizzle-kit/bin.cjs ]
```

## Першопричина

Схема — ESM/NodeNext ([ADR-003](../../../architecture-decisions.md)), тож TS-файли імпортують одне
одного з суфіксом `.js` (`export * from './enums.js'`). `drizzle-kit` завантажує `schema` через
**CJS `require`** (власний лоадер на базі `@esbuild-kit`), який не резолвить `.js`-специфікатор
у `.ts`-файл.

## Розв'язання

`NODE_OPTIONS='--import tsx'` у скрипті `db:generate` (commit `fbbbff3`, 2026-06-09):
`--import tsx` реєструє **обидва** хуки tsx — ESM loader і CJS `require`-патч, і саме CJS-хук
резолвить `.js` → `.ts` для лоадера drizzle-kit.

```json
"db:generate": "NODE_OPTIONS='--import tsx' drizzle-kit generate"
```

## Верифікація (2026-06-10)

- `pnpm db:generate` (drizzle-kit 0.30.6) — зелений на Node 22 (mise) **і** Node 26;
  без `NODE_OPTIONS` помилка відтворюється — фікс необхідний і достатній.
- На незміненій схемі: `No schema changes` — рукописні snapshots узгоджені зі схемою.
- Smoke-тест із тестовою колонкою: згенеровано коректні `0006_*.sql`, `meta/0006_snapshot.json`
  (правильні `id`/`prevId`) і запис у `_journal.json`. Артефакти тесту відкочено.
- Рукописне ведення snapshots/journal більше **не потрібне**; цикл із
  [database.md](../../../database.md) (`schema → db:generate → db:migrate`) працює як описано.
  Доведення згенерованого SQL до ідемпотентного вигляду руками — лишається (див.
  [BUG-1](BUG-1-rerun-0000-fails-on-migrated-db.md)).

## Досліджені альтернативи (не потрібні)

- **SWC-хук (`@swc-node/register`)** — нова залежність без виграшу: SWC у проєкті лише білдер
  nest-cli, на внутрішній `require` drizzle-kit можна вплинути тільки через `NODE_OPTIONS`-хуки,
  а tsx уже встановлений і робить це.
- **Оновлення drizzle-kit до 0.31.10** — не лікує саме по собі і тягне оновлення
  `drizzle-orm` 0.36.4 → 0.45.x (kit 0.31 відмовляється стартувати:
  `Please install latest version of drizzle-orm`). Окреме рішення, до цього бага не стосується.
  Гілка `drizzle 1.0.0-rc` — тим паче зарано.

## Релевантні файли

- [`apps/server/package.json`](../../../../apps/server/package.json)
- [`apps/server/drizzle.config.ts`](../../../../apps/server/drizzle.config.ts)
- [`apps/server/src/db/schema/index.ts`](../../../../apps/server/src/db/schema/index.ts)
