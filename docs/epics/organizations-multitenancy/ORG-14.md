---
id: ORG-14
epic: organizations-multitenancy
phase: 4
type: feat
status: todo
depends_on: [ORG-5]
parallelizable: false
branch:
pr:
---

# ORG-14 — Auth-стор (cookie-only) + перемикач організацій

**Епік:** [organizations-multitenancy](../organizations-multitenancy.md) · **Фаза 4** · **Залежності:** ORG-5

## Мета

Перевести фронт на cookie-only auth і дати перемикач активної організації.

## Обсяг

- Прибрати зберігання `accessToken` у сторі; API-клієнт ходить із `credentials: include` без
  `Authorization`; сесія бутстрапиться через `me`.
- Додати в стор `userRole`, `memberships`, `activeOrgId`, `orgRole`.
- Перемикач активної org у хедері → виклик `switch-org` + рефреш даних (інвалідизація TanStack Query).
- Меню «Адмін» — за `userRole === 'superuser'`.
- Прибрати поля `public_slug` із форм авто.

## Критерії приймання

- Логін/сесія працюють без body-токена.
- Перемикання org оновлює всі списки; платформне меню видно лише superuser.
- Стан активної org переживає перезавантаження.

## Релевантні файли

- [`auth.store.ts`](../../../apps/client/src/stores/auth.store.ts), [`api/auth.api.ts`](../../../apps/client/src/api/auth.api.ts)
- [`AppLayout.tsx`](../../../apps/client/src/components/layout/AppLayout.tsx)
- API-клієнт (axios instance), форми авто (vehicles)
