# Тестування та CI

## Філософія

Тестуємо те, що дає максимум впевненості за мінімум зусиль: бекенд-сервіси з **логікою** (а не CRUD-
обгортки) і ключові утиліти/форми фронтенду. Загальне coverage не є самоціллю — фокус на якісних тестах
критичних шляхів.

## Інструменти

| Інструмент                      | Роль                                                              |
| ------------------------------- | ----------------------------------------------------------------- |
| **Vitest**                      | Єдиний test-runner для BE і FE.                                   |
| **@testing-library/react**      | Component-тести фронтенду (середовище `happy-dom`).              |
| **@testing-library/user-event** | Симуляція взаємодій.                                             |
| **supertest** (за потреби)      | HTTP-рівневі тести NestJS-контролерів.                          |
| **Husky** + **lint-staged**     | Pre-commit хук.                                                  |
| **GitHub Actions**              | CI на push/PR.                                                   |

## Бекенд: unit-тести

`db`-клієнт мокається; перевіряємо логіку сервісів. Наявні `*.service.spec.ts` покривають, зокрема:

| Модуль / сервіс              | Що перевіряємо                                                            |
| ---------------------------- | ------------------------------------------------------------------------- |
| `AuthService`                | хешування, перевірка пароля, видача access/refresh, помилки login.        |
| `ExchangeRatesService`       | курс за датою; fallback на попередній місяць; throw при відсутності.       |
| `ExpensesService`            | автозаповнення `rate`/`rate_source='default'`; збереження `manual` rate.   |
| `DocumentsService`           | ownership-правила; коректність upload/link.                              |
| `VehiclesService`            | при зміні `statusId` створюється запис у `vehicle_status_history`.         |
| `VehiclePhotosService`       | ліміт 10 фото; порядок галереї.                                          |
| `DictionariesService`        | RESTRICT → 409 при видаленні використовуваного елемента.                 |
| `DashboardService`           | агрегації KPI за `vehicle_status_kind`.                                  |
| `PublicService`              | санітизація DTO; 404 для непублічних/видалених авто.                     |
| `HttpExceptionFilter`        | приведення винятків до єдиного формату помилок.                          |

Приклад:

```ts
describe('ExchangeRatesService', () => {
  it('returns 1 for UAH regardless of date', () => {
    expect(svc.getRate(new Date('2025-03-15'), 'UAH')).toBe(1);
  });
  it('falls back to nearest past month', () => {
    expect(svc.getRate(new Date('2024-06-15'), 'USD')).toBe(39.475);
  });
  it('throws when no past rate available', () => {
    expect(() => svc.getRate(new Date('2010-01-01'), 'USD')).toThrow(/NO_RATE/);
  });
});
```

Для інтеграційних тестів (опційно) — окрема БД `volunteerfleet_test` у тому ж docker-postgres з очищенням
(`TRUNCATE ... CASCADE`) перед прогоном.

## Фронтенд: component-тести

Покриваємо ключові форми (логін, форма витрати з auto-fetch курсу) і утиліти (`formatCurrency`,
`formatDate`, `zod-antd` адаптер). Середовище — `happy-dom`; setup-файл імпортує
`@testing-library/jest-dom/vitest` і мокає `window.matchMedia` для Ant Design. HTTP мокається через
`vi.mock` (за потреби — MSW).

## Coverage

```bash
pnpm -r test -- --coverage
```

З coverage виключаємо generated-код (`drizzle/`), `main.ts`, `*.module.ts`, тестові утиліти.

## Pre-commit (Husky + lint-staged)

`.husky/pre-commit` запускає `lint-staged`:

```json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml,yaml,css}": ["prettier --write"]
}
```

Тести у pre-commit **не** запускаються (повільно при кожному коміті) — вони на стороні CI.

## CI (GitHub Actions)

На push/PR: `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm typecheck` → `pnpm test`. Для тестів,
що ходять у БД, піднімається service-контейнер `postgres:16-alpine` і передаються тестові `DATABASE_URL`
та `JWT_*_SECRET` через env. Гілки `main` (та, за наявності, інтеграційна) захищені вимогою зеленого CI.

Кандидати на додавання: `pnpm audit`, перевірка `pnpm build`, coverage-звіт у PR.

## Поза межами першої версії

E2e (Playwright/Cypress), mutation testing, visual regression, load testing, contract testing
(не потрібне при monorepo зі спільними схемами).
