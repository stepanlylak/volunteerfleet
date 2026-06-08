---
id: ORG-5
epic: organizations-multitenancy
phase: 1
type: feat
status: todo
depends_on: [ORG-1, ORG-3, ORG-4]
parallelizable: false
branch:
pr:
---

# ORG-5 — JWT активної організації + cookie-only + `switch-org`

**Епік:** [organizations-multitenancy](../organizations-multitenancy.md) · **Фаза 1** · **Залежності:**
ORG-1, ORG-3, ORG-4

## Мета

Носити активну організацію в токені, прибрати body-токен, дати перемикання організацій (розд. 6 епіку).

## Обсяг

- Клейми access/refresh: `role → userRole`, додати `activeOrgId`, `orgRole`; оновити `jwtPayloadSchema`.
- **Прибрати accessToken із тіла** `login`/`refresh`; `JwtAuthGuard` читає токен із куки `access_token`
  (Bearer прибрати).
- Логіка вибору активної org на login/refresh (last_active_org_id → перше членство → null).
- `POST /api/v1/auth/switch-org { organizationId }` — валідація членства, оновлення `last_active_org_id`,
  перевипуск кук.
- `login`/`me` повертають `userRole`, `memberships`, `activeOrgId`, `orgRole` — **без токена в тілі**.

## Критерії приймання

- Авторизація працює лише на куках; тіло відповідей не містить токена.
- switch-org валідує членство і перевипускає куку; невалідна org → 403/404.
- refresh зберігає активну org.

## Інваріанти

Інваріант 6 (cookie-only / CSRF): жодних state-changing GET.

## Релевантні файли

- [`auth.service.ts`](../../../apps/server/src/modules/auth/auth.service.ts), [`auth.controller.ts`](../../../apps/server/src/modules/auth/auth.controller.ts)
- [`packages/shared/src/schemas/auth.ts`](../../../packages/shared/src/schemas/auth.ts)
- [`common/guards/jwt-auth.guard.ts`](../../../apps/server/src/common/guards/jwt-auth.guard.ts)
- [`users.service.ts`](../../../apps/server/src/modules/users/users.service.ts) — `last_active_org_id`
