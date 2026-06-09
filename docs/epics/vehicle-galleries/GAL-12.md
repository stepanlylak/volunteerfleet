---
id: GAL-12
epic: vehicle-galleries
phase: 3
type: test
status: ready
depends_on: [GAL-6, GAL-7, GAL-9, GAL-11]
parallelizable: false
branch:
pr:
---

# GAL-12 — Наскрізна регресія та документація

**Епік:** [vehicle-galleries](../vehicle-galleries.md) · **Фаза 3** · **Залежності:** GAL-6, GAL-7, GAL-9, GAL-11

## Мета

Закрити інтеграційні ризики епіка та синхронізувати технічну документацію.

## Обсяг

- Додати/звести regression matrix з розділу 11 епіка.
- Backend integration:
  main invariant та editable description, permissions, org isolation, 30/concurrency, reorder,
  cover, move, delete cascade, public visibility та direct download.
- Frontend:
  coordinator/volunteer/viewer controls, modal flows, public sections, main cover/placeholder,
  відсутність photo field у vehicle form.
- Перевірити clean DB bootstrap: migrate, seed, create vehicle, main gallery.
- Перевірити OpenAPI та API docs.
- Оновити `docs/api.md`, `docs/database.md`, `docs/files.md`, `docs/frontend.md` і за потреби
  `docs/testing.md`.
- Зафіксувати, що physical MinIO cleanup, video та gallery reorder залишаються out of scope.
- Виконати повний PR checklist репозиторію.

## Критерії приймання

- Усі сценарії епіка покриті автоматизованими тестами або явно задокументованою manual verification.
- `pnpm lint`, `pnpm -w typecheck`, `pnpm test` зелені.
- Clean migration/seed проходять.
- Документація не описує старий ліміт 10 або плоский photo API.
- Public/private доступ перевірений окремими негативними тестами.

## Релевантні файли

- server/client integration and component specs
- `docs/api.md`
- `docs/database.md`
- `docs/files.md`
- `docs/frontend.md`
- `docs/testing.md`
