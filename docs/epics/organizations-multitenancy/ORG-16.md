---
id: ORG-16
epic: organizations-multitenancy
phase: 4
type: feat
status: todo
depends_on: [ORG-13, ORG-14]
parallelizable: true
branch:
pr:
---

# ORG-16 — Налаштування організації (coordinator)

**Епік:** [organizations-multitenancy](../organizations-multitenancy.md) · **Фаза 4** · **Залежності:**
ORG-13, ORG-14 (паралельно з ORG-15/17)

## Мета

Дати coordinator UI для своєї організації — інфо + склад в одному місці.

## Обсяг

- Модалка/сторінка налаштувань активної org для `coordinator`:
  - редагування інфо організації;
  - керування учасниками (додати існуючого за email, змінити роль, зняти).
- Видимість — лише за `orgRole === 'coordinator'`.

## Критерії приймання

- Coordinator редагує свою org і її склад.
- volunteer/viewer цього екрана не бачать.

## Релевантні файли

- `apps/client/src/pages/` або `modals/` (новий екран налаштувань org)
- [`AppLayout.tsx`](../../../apps/client/src/components/layout/AppLayout.tsx) — точка входу
