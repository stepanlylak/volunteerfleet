# Мультивалюта та курси

Витрати заводяться у валюті фактичної оплати (UAH/USD/EUR), а звіти зводяться у базову валюту **UAH**.
Кожна витрата зберігає курс до UAH, чинний на момент події. Обґрунтування — [ADR-009](architecture-decisions.md#adr-009-мультивалюта-зі-збереженим-курсом-на-кожній-витраті).

## Базова валюта й список

```ts
// packages/shared/src/constants/currencies.ts
export const CURRENCIES = ['UAH', 'USD', 'EUR'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const BASE_CURRENCY: Currency = 'UAH';
```

Для UAH-витрат завжди `rate = 1.000000`. Розширення списку — додати елемент у масив + рядки в JSON-курсах
+ опцію в UI Select.

## Джерело курсів — локальний JSON

Файл `apps/server/data/exchange-rates.json` з помісячною деталізацією:

```json
{
  "2024-05": { "USD": 39.475, "EUR": 42.69 },
  "2026-05": { "USD": 41.23, "EUR": 44.85 }
}
```

- Ключ — `YYYY-MM`; значення — `{ <валюта>: <курс до UAH> }`. UAH у файлі не зберігається (завжди 1).
- Помісячний курс — свідоме спрощення; для волонтерських обсягів денний не потрібен.
- Шлях задається через ENV `EXCHANGE_RATES_FILE`.

## `ExchangeRatesService`

Сервіс вантажить JSON у пам'ять на старті (`OnModuleInit`) і віддає курс за датою:

- для UAH → `1`;
- для USD/EUR → шукає курс місяця `YYYY-MM`; якщо немає — **fallback до останнього доступного
  попереднього місяця** (ніколи не «з майбутнього»: на момент події майбутній курс ще невідомий);
- якщо даних узагалі немає → виняток, контролер віддає `422 BUSINESS_RULE_VIOLATION`.

### API

`GET /api/v1/exchange-rates?date=2026-05-21&currency=USD`

```json
{ "date": "2026-05-21", "currency": "USD", "rate": 41.23, "source": "default" }
```

UI викликає цей ендпоінт у формі витрати при зміні дати або валюти.

## Поведінка форми витрати

1. Користувач заповнює `expenseDate`, `currency`, `amount`.
2. При зміні дати **або** валюти:
   - `currency = UAH` → `rate = 1.000000`, поле disabled;
   - інакше → fetch курсу → автозаповнення `rate`, `rateSource = 'default'`.
3. Користувач може вручну змінити `rate` → `rateSource = 'manual'` (UI підсвічує іконку редагування).
4. Кнопка «Скинути до дефолтного» повертає автозначення і `rateSource = 'default'`.
5. Під сумою показується обчислене значення в UAH: `<amount> <currency> ≈ <amount × rate> UAH`.

**При редагуванні** курс не перетягується автоматично — користувач має явно натиснути «скинути до
дефолтного», бо збережений курс є історичним фактом ([ADR-010](architecture-decisions.md#adr-010-історичний-курс-не-перераховується-автоматично-при-редагуванні-витрати)).

## Збереження у БД

`expenses`: `amount numeric(14,2)`, `currency enum`, `rate numeric(14,6)`, `rate_source enum`. Курс
зберігається **на запис**, а не вираховується щоразу з сервісу — це гарантує, що історичний звіт лишається
стабільним навіть після оновлення JSON-курсів.

## Агрегації у звітах

Сума витрат у UAH:

```sql
SELECT COALESCE(SUM(amount * rate), 0) AS total_uah
FROM expenses WHERE vehicle_id = $1 AND deleted_at IS NULL;
```

Розбивка по валютах (показуємо і у валюті, і в UAH):

```sql
SELECT currency, SUM(amount) AS total_in_currency, SUM(amount * rate) AS total_uah
FROM expenses WHERE vehicle_id = $1 AND deleted_at IS NULL GROUP BY currency;
```

Розподіл по категоріях для звіту по джерелу:

```sql
SELECT c.name AS category, SUM(e.amount * e.rate) AS total_uah
FROM expenses e JOIN expense_categories c ON c.id = e.category_id
WHERE e.funding_source_id = $1 AND e.expense_date BETWEEN $2 AND $3 AND e.deleted_at IS NULL
GROUP BY c.name ORDER BY total_uah DESC;
```

## Точність

- Обчислення на бекенді — в Postgres `numeric` (без втрат точності). Drizzle повертає `numeric` як
  `string`; проміжні суми не парсяться у JS `number`.
- Відображення в UI — через `Intl.NumberFormat('uk-UA', …)` (суми — 2 знаки, курси — 4 знаки).

## Поза межами першої версії

Інтеграція з API курсів (НБУ → денний курс), окремий UI «Управління курсами» для адміна, крос-курси без
UAH, додаткові валюти, перерахунок історичних витрат при оновленні курсів (свідомо не робимо — збережений
курс гарантує стабільність звітів).
