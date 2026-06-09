---
id: FIN-11
epic: financial-flow
phase: 2
type: feat
status: done
depends_on: [FIN-5]
parallelizable: true
branch: feat/fin-11-donor-picker-page
pr:
---

# FIN-11 — Donor picker і сторінка донорів

**Епік:** [financial-flow](../financial-flow.md) · **Фаза 2** · **Залежності:** FIN-5 (паралельно з donation backend)

## Мета

Вибір донора, inline-створення і приєднання за UUID — без переходу в admin dictionaries.

## Обсяг

- Сторінка `/donors` (розд. 8.4): список донорів active org, ім'я, UUID з copy action, кнопки «Додати донора», «Додати за ID», «Приховати зі списку». Не показує зв'язки з іншими org.
- Reusable `DonorPicker` (розд. 8.3): пошук серед донорів active org; дія «Створити нового донора» (inline ім'я); дія «Додати за ID» (exact UUID lookup + confirmation); після створення/link донор одразу вибраний.
- API-клієнт і hooks для donors; пункт меню.

## Критерії приймання

- Користувач завершує обидва flows (inline create і add-by-ID) без переходу в admin dictionaries.
- Сторінка не розкриває, з якими іншими організаціями пов'язаний донор.

## Релевантні файли

- `apps/client/src/pages/donors/*` (новий), `components/DonorPicker.tsx` (новий)
- `apps/client/src/api/donors.api.ts`, `hooks/useDonors.ts` (нові)
- [`apps/client/src/components/layout/AppLayout.tsx`](../../../apps/client/src/components/layout/AppLayout.tsx) (меню)
