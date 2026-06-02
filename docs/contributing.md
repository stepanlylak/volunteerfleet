# Контриб'юшн і git-воркфлоу

Дякуємо за інтерес до проєкту. Перед суттєвою роботою відкрийте issue, щоб узгодити напрям.

## Гілки

- **Базова гілка — `main`** (production-ready).
- Робочі гілки відгалужуються від `main` за схемою `<type>/<short-name>`:
  `feat/vehicles-registry`, `fix/expense-rate-rounding`, `chore/eslint-config`, `docs/api-update`,
  `refactor/...`, `test/...`.
- Перед створенням гілки — `git fetch origin`.
- **Не пушимо напряму в `main`** — лише через Pull Request.

## Конвенції комітів (Conventional Commits)

```
<type>(<scope>): <subject>
```

- `subject` — імператив, англійською, без крапки в кінці, ≤ 72 символи (`add login form`).
- `scope` (опц.) — частина системи: `auth`, `vehicles`, `expenses`, `documents`, `db`, `client`,
  `server`, `shared`, `docs`.
- `!` після `type`/`scope` — breaking change (+ секція `BREAKING CHANGE:` у footer).

| `type`     | Коли                            |
| ---------- | ------------------------------- |
| `feat`     | Нова функціональність.          |
| `fix`      | Виправлення бага.               |
| `refactor` | Без зміни поведінки.            |
| `perf`     | Продуктивність.                 |
| `test`     | Тільки тести.                   |
| `docs`     | Тільки документація.            |
| `chore`    | Конфіги, скрипти, інфра.        |
| `build`    | Build system, залежності.       |
| `ci`       | CI/CD.                          |

Приклади:

```
feat(vehicles): add registry table with status and search filters
fix(expenses): use prior month rate when month missing in JSON
docs(currency): clarify rounding rules
```

## Pull Request

- База PR — `main`. Заголовок PR — у форматі Conventional Commits (стане commit-повідомленням при squash).
- Опис — короткий summary + чек-ліст:
  - [ ] Тести (де доречно)
  - [ ] Документація оновлена (`docs/`, ADR за потреби)
  - [ ] Міграції згенеровані й застосовані (якщо чіпали схему)
  - [ ] Локально пройшли `pnpm lint`, `pnpm typecheck`, `pnpm test`
- `main` захищена: merge лише через PR із зеленим CI.

## Перед комітом

Pre-commit хук (Husky + lint-staged) автоматично проганяє ESLint і Prettier на staged-файлах. Перед
відкриттям PR прогоніть локально:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Робота з базою даних

Зміна схеми → редагуєте `apps/server/src/db/schema/*.ts` → `pnpm db:generate` (drizzle-kit згенерує
SQL-міграцію) → перевіряєте згенерований SQL очима → коммітите міграцію разом зі змінами схеми →
`pnpm db:migrate`. Згенеровані міграції (`apps/server/drizzle/`) комітяться у репозиторій.

## Версіонування (SemVer)

`MAJOR.MINOR.PATCH`: MAJOR — breaking changes в API/БД; MINOR — зворотно-сумісна функціональність;
PATCH — виправлення. Релізи позначаються тегами (`v0.1.0`); зміни ведуться у `CHANGELOG.md`
(формат Keep a Changelog).

## Мовні правила

- **Англійською:** код та ідентифікатори (змінні, функції, класи, файли, NestJS-модулі), назви
  таблиць/колонок, ключі API, коміт-повідомлення, технічні README в коді. Коментарі в коді — англійською
  й мінімальні (лише нетривіальне «чому»).
- **Українською:** UI-тексти застосунку, документація для кінцевих користувачів, ця технічна документація
  в `docs/`.

## Принципи

- Не вигадуйте конвенцій, яких ще немає в репозиторії; якщо щось неясно — спитайте в issue.
- Не додавайте функцій, рефакторингів чи абстракцій понад потрібне для задачі.
- Не вводьте нові залежності без явного узгодження.
- Нове нетривіальне архітектурне рішення — фіксуйте записом у [architecture-decisions.md](architecture-decisions.md).
