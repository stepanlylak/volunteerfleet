---
id: BUG-1
epic: financial-flow
type: bug
status: todo
severity: high
found_in: [FIN-10, FIN-6, FIN-7]
branch:
---

# BUG-1 — Курс не оновлюється при зміні валюти

**Епік:** [financial-flow](../../financial-flow.md) · **Знайдено в:** FIN-10 (MoneyFields), FIN-6/FIN-7 (donations/expenses update)

Інваріант фінансової моделі: **курс завжди відповідає парі (валюта, дата)**. `rate` для UAH = 1;
для не-UAH — підтягується з помісячних курсів (`ExchangeRatesService`), або задається вручну
(`rateSource = 'manual'`). Зараз цей інваріант порушується і на фронтенді, і на бекенді: при зміні
валюти курс не перераховується.

## Симптом

### Фронтенд (форми донату й витрати)

Кроки (форма «Додати/Редагувати надходження» або «…витрату»):

1. Обрати валюту **USD** → курс підтягується коректно (напр. `38.50`). ✅
2. Змінити валюту на **UAH** → поле курсу зникає, курс примусово стає `1`. ✅ (очікувано)
3. Знову змінити валюту на **USD** → **курс лишається `1`** замість того, щоб підтягнутись назад. ❌

Окремий, гарантований випадок — **режим редагування**: при редагуванні наявного запису зміна
валюти (чи дати) **взагалі ніколи** не підтягує свіжий курс — користувач мусить вводити його вручну
або тиснути «Скинути».

### Бекенд (PATCH donation/expense)

API дозволяє змінити `currency` без передачі `rate`, і сервер **не нормалізує** курс:

- `donations` — зміна валюти на **UAH** без `rate` лишає старий курс (напр. `38.5`) і **порушує
  CHECK-констрейнт** `donations_rate_one_for_uah` → запит падає з **500**. Відтворено на чистій БД:

  ```text
  ERROR: new row for relation "donations" violates check constraint "donations_rate_one_for_uah"
  DETAIL: Failing row contains (..., UAH, 38.500000, manual, ...).
  ```

- `expenses` — випадок →UAH оброблено (курс скидається в `1`), але зміна між не-UAH валютами
  (USD→EUR) без `rate` лишає **застарілий** курс попередньої валюти.

> На UI бекендний 500 наразі не відтворюється, бо форма завжди надсилає `rate`. Але контракт це
> дозволяє (`donationUpdateSchema`/`expenseUpdateSchema` мають `currency` і `rate` незалежними
> optional-полями), тож це латентний баг, який варто закрити на сервері.

## Першопричина

### FE — `apps/client/src/components/MoneyFields.tsx`

Уся логіка автопідстановки курсу — в `MoneyFields`. Три фрагменти конфліктують:

```ts
// 1) гейт запиту курсу — у режимі edit запит ВИМКНЕНО назавжди
const shouldFetchRate = !isUAH && !!date && !isEdit;
const { data: rateData } = useExchangeRate(
  shouldFetchRate ? date : undefined,
  shouldFetchRate ? currency : undefined,
);

// 2) автозастосування — залежить ТІЛЬКИ від rateData (ref із кешу TanStack)
useEffect(() => {
  if (rateData && !isRateManuallyChangedRef.current) {
    onRateChange(rateData.rate);
    onRateSourceChange('default');
    form.setFieldValue(rateFieldName, rateData.rate);
  }
}, [rateData, form, rateFieldName, onRateChange, onRateSourceChange]);

// 3) скидання для UAH — БЕЗ гарду isEdit, завжди форсить rate=1
useEffect(() => {
  if (isUAH) {
    isRateManuallyChangedRef.current = false;
    onRateChange(1);
    onRateSourceChange('default');
    form.setFieldValue(rateFieldName, 1);
  }
}, [isUAH, form, rateFieldName, onRateChange, onRateSourceChange]);
```

- **`!isEdit` у `shouldFetchRate`** — у режимі редагування курс не підтягується ніколи. Поєднано з
  ефектом (3), який працює і в edit, після проходу через UAH курс лишається `1` без можливості
  автовідновлення.
- **Ефект (2) зав'язаний лише на `rateData`.** Курс застосовується як побічний ефект приходу даних
  запиту, а не як реакція на зміну валюти. `useExchangeRate` має `staleTime: 10 хв`, тож при поверненні
  до раніше запитаної валюти TanStack віддає той самий закешований об'єкт — повторного застосування
  курсу не відбувається, і значення, затерте ефектом (3) у `1`, не відновлюється.
- **Джерело правди розмазане**: курс живе в state батька (`rate`), у полі форми (`rateFieldName`) і в
  даних запиту (`rateData`) — їх синхронізують руками через кілька ефектів, звідки і неузгодженість.

Однаково стосується **обох** форм — [`DonationFormModal`](../../../../apps/client/src/modals/DonationFormModal.tsx)
і [`ExpenseFormModal`](../../../../apps/client/src/modals/ExpenseFormModal.tsx) використовують спільний `MoneyFields` з `isEdit`.

### BE — `*.service.ts` `update()`

```ts
// expenses.service.ts — →UAH оброблено, не-UAH→не-UAH лишає старий rate
if (input.currency === BASE_CURRENCY) {
  updateValues.rate = '1.000000';
  updateValues.rateSource = 'default';
} else if (input.rate !== undefined) {
  updateValues.rate = input.rate.toFixed(6);
  updateValues.rateSource = 'manual';
}

// donations.service.ts — НЕМАЄ гілки BASE_CURRENCY; rate чіпається лише якщо переданий явно
if (input.rate !== undefined) {
  updateValues.rate = input.rate.toFixed(6);
  updateValues.rateSource = 'manual';
}
```

## Бажана поведінка

При зміні валюти курс має **завжди** приводитись у відповідність до пари (валюта, дата):

- **UAH** → `rate = 1`, `rateSource = 'default'`, поле курсу приховане.
- **не-UAH** → автопідтяг курсу для (дата, валюта) з `ExchangeRatesService`, `rateSource = 'default'` —
  **у режимах create і edit однаково**, і при поверненні до раніше обраної валюти теж.
- **ручне редагування** курсу → `rateSource = 'manual'`, автопідтяг не перетирає ручне значення для
  поточної валюти; при наступній зміні валюти ручний прапорець скидається й курс підтягується знову.

## Пропозиція виправлення (ескіз)

### FE

- Прибрати `!isEdit` із `shouldFetchRate` (підтягувати курс і в edit).
- Перенести автопідстановку з «реакції на `rateData`» на **реакцію на зміну `currency`/`date`**:
  при зміні валюти на не-UAH явно резолвити курс (через `exchangeRatesApi.getRate`, як уже робить
  `handleReset`) і застосовувати, якщо `rateSource !== 'manual'`. Це усуває залежність від
  кеш-референса TanStack.
- Гард ручного режиму лишити — ручний курс не перетирається, доки користувач знову не змінить валюту.

### BE (нормалізація в `update()`, дзеркально для donations і expenses)

```ts
if (input.currency !== undefined) {
  if (input.currency === BASE_CURRENCY) {
    updateValues.rate = '1.000000';
    updateValues.rateSource = 'default';
  } else if (input.rate !== undefined) {
    updateValues.rate = input.rate.toFixed(6);
    updateValues.rateSource = 'manual';
  } else {
    const date = input.donationDate ?? existing.donationDate; // expenseDate для expenses
    updateValues.rate = this.exchangeRates
      .getRate(new Date(date), input.currency as Currency)
      .toFixed(6);
    updateValues.rateSource = 'default';
  }
} else if (input.rate !== undefined) {
  updateValues.rate = input.rate.toFixed(6);
  updateValues.rateSource = 'manual';
}
```

## Критерії приймання

- FE: create — USD→UAH→USD відновлює підтягнутий курс (не `1`).
- FE: edit — зміна валюти на не-UAH підтягує свіжий курс; на UAH ховає поле й ставить `1`.
- FE: ручний курс не перетирається автопідтягом, доки валюта не змінилась.
- BE: PATCH donation з `currency: 'UAH'` без `rate` → `200`, `rate=1`, `rateSource='default'`
  (немає 500 від `donations_rate_one_for_uah`).
- BE: PATCH expense/donation зі зміною не-UAH валюти без `rate` → курс перерахований за датою запису.
- Юніт-тест на кейс →UAH без rate для `donations.service.update`.

## Релевантні файли

- [`apps/client/src/components/MoneyFields.tsx`](../../../../apps/client/src/components/MoneyFields.tsx)
- [`apps/client/src/hooks/useExchangeRate.ts`](../../../../apps/client/src/hooks/useExchangeRate.ts)
- [`apps/client/src/modals/DonationFormModal.tsx`](../../../../apps/client/src/modals/DonationFormModal.tsx)
- [`apps/client/src/modals/ExpenseFormModal.tsx`](../../../../apps/client/src/modals/ExpenseFormModal.tsx)
- [`apps/server/src/modules/donations/donations.service.ts`](../../../../apps/server/src/modules/donations/donations.service.ts)
- [`apps/server/src/modules/expenses/expenses.service.ts`](../../../../apps/server/src/modules/expenses/expenses.service.ts)
