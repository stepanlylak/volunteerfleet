# Епік: Галереї автомобілів (Vehicle Galleries)

> **Статус:** Proposed (готовий до реалізації)
> **Тип:** Епік / заміна наявної моделі фотографій
> **Зачіпає:** `apps/server`, `apps/client`, `packages/shared`, схему БД, MinIO, public API
> **Трекінг:** планування ведеться в репозиторії (`docs/epics/`); зовнішній трекер не використовується.
> **Мова документа:** українська (наратив), англійська (код, API, таблиці та колонки).

Цей документ є джерелом правди для епіка. Декомпозиція на робочі тікети міститься у
[`vehicle-galleries/README.md`](vehicle-galleries/README.md).

---

## 1. Контекст і проблема

Зараз автомобіль має один плоский список `vehicle_photos`:

- усі фото належать безпосередньо автомобілю;
- діє глобальний ліміт 10 фото на автомобіль;
- немає назви, опису, підписів, обкладинки або групування;
- публічна сторінка показує всі активні фото публічного автомобіля;
- керування фото частково знаходиться у формі створення/редагування автомобіля.

Цього недостатньо для поділу фотографій за етапами або призначенням, наприклад «До ремонту»,
«Після ремонту», «Передача підрозділу». Також неможливо окремо контролювати, які групи фотографій
можна показувати на публічних сторінках і у звітах.

## 2. Мета

Замінити плоский список фотографій на галереї:

- кожен автомобіль автоматично має системну `main`-галерею;
- користувачі можуть створювати додаткові галереї;
- додаткові галереї приватні за замовчуванням і можуть бути опубліковані;
- кожна галерея має до 30 фотографій, власний порядок та обкладинку;
- фото мають необов'язковий підпис і можуть переноситися між галереями;
- публічні сторінки показують `main` та опубліковані додаткові галереї окремими секціями;
- обкладинка `main`-галереї представляє автомобіль у списках і картках.

## 3. Зафіксовані рішення

1. **`main` створюється разом з автомобілем.** Автомобіль не може існувати без активної
   `main`-галереї. Створення автомобіля та галереї виконується в одній транзакції.
2. **`main` не можна видалити, перейменувати або зробити приватною.** У UI її назва відображається як
   «Основна». Технічно її `kind = main`, `is_public = true`. Необов'язковий опис `main` можна
   редагувати.
3. **Фактична публічність завжди залежить від автомобіля.** Галерея доступна без авторизації лише коли
   `vehicle.is_public = true AND gallery.is_public = true`. Тому `main` стає видимою або невидимою
   разом з автомобілем без оновлення самої галереї.
4. **Додаткова галерея (`kind = custom`) приватна за замовчуванням.** Її можна зробити публічною.
5. **Назви активних додаткових галерей у межах одного автомобіля унікальні без урахування регістру.**
   Назва обов'язкова; опис необов'язковий.
6. **Галереї поки не сортуються вручну**, але мають `sort_order`. `main` завжди має `sort_order = 0`,
   нові галереї отримують наступне значення. API та UI повертають `main` першою, решту за
   `sort_order`, потім `created_at`.
7. **Ліміт становить 30 активних фото на одну галерею.** Ліміту на сумарну кількість галерей або фото
   автомобіля в цьому епіку немає.
8. **Поки підтримуються лише зображення:** JPEG, PNG, WebP, HEIC; чинний ліміт розміру одного файлу
   зберігається. Серверна генерація thumbnail або конвертація форматів не додається.
9. **Модель item є розширюваною.** Таблиця називається `vehicle_gallery_items`, а не
   `vehicle_photos`, і має `type = image`. Додавання `video` у майбутньому не повинно вимагати
   створення іншої сутності галереї.
10. **Підпис фото (`caption`) необов'язковий.** Порожній рядок нормалізується у `null`.
11. **Обкладинка може бути явною або обчисленою.** `cover_item_id` nullable. Якщо явної активної
    обкладинки немає, ефективною обкладинкою є перше активне фото за порядком.
12. **Видалення або перенесення явної обкладинки очищує `cover_item_id`.** Нова явна обкладинка не
    записується автоматично; UI одразу використовує перше фото як fallback.
13. **Перенесення фото зберігає підпис** і додає фото в кінець цільової галереї (`COALESCE(MAX(sort_order), 0) + 1`). Перенесення
    відхиляється, якщо цільова галерея вже має 30 фото.
14. **Видалення галереї soft-delete'ить галерею та всі її активні items в одній транзакції.**
    Файли у MinIO фізично не видаляються в межах цього епіка. `main` видалити неможливо.
15. **Видалення окремого фото також є soft-delete.** Restore UI/API у цьому епіку не додається.
16. **Доступ в адмінській частині:**
    - `coordinator`, `volunteer`, `viewer` можуть переглядати всі галереї доступного їм автомобіля;
    - `coordinator` і `volunteer` можуть створювати, редагувати та видаляти додаткові галереї,
      керувати публічністю, завантажувати, редагувати, сортувати, переносити й видаляти будь-які фото;
    - `viewer` має лише read-only доступ.
17. **Правило власника фото прибирається.** `volunteer` може видаляти не лише завантажені ним фото.
18. **Керування переноситься на картку автомобіля.** Окрема модалка галереї підтримує метадані,
    завантаження, підписи, сортування, обкладинку, перенесення та видалення. Поле фото прибирається
    з `VehicleFormModal`.
19. **Публічна сторінка показує галереї окремими секціями** з назвою, необов'язковим описом і фото
    у визначеному порядку. Приватні галереї та їхні файли повертають `404`.
20. **Живих даних немає.** Наявні міграції та сіди можна змінити так, ніби галереї були частиною
    системи від початку. Backfill зі старої `vehicle_photos` не потрібен.

## 4. Цільова модель даних

### Enum `vehicle_gallery_kind`

- `main`
- `custom`

### Enum `vehicle_gallery_item_type`

- `image`

Enum навмисно описує тип item. Майбутнє `video` додається новим значенням без зміни зв'язків між
автомобілем, галереєю та item.

### Таблиця `vehicle_galleries`

| Колонка           | Тип                           | Правила |
| ----------------- | ----------------------------- | ------- |
| `id`              | uuid PK                       | `gen_random_uuid()` |
| `organization_id` | uuid NOT NULL                 | FK `organizations`, tenant scope |
| `vehicle_id`      | uuid NOT NULL                 | FK `vehicles`, `ON DELETE RESTRICT` |
| `kind`            | `vehicle_gallery_kind`        | NOT NULL |
| `name`            | varchar(255) NULL             | required для `custom`, `NULL` для `main` |
| `description`     | text NULL                     | лише user-authored metadata |
| `is_public`       | boolean NOT NULL DEFAULT false | для `main` завжди true |
| `sort_order`      | integer NOT NULL DEFAULT 0    | sequence для майбутнього reorder |
| `cover_item_id`   | uuid NULL                     | FK/logical reference на активний item цієї галереї |
| audit fields      | стандартні                    | `created_by`, `updated_by`, timestamps, soft-delete |

Обмеження та індекси:

- partial unique: один активний `kind = main` на `vehicle_id`;
- partial unique expression: активна custom-назва унікальна за
  `(vehicle_id, lower(trim(name))) WHERE deleted_at IS NULL`;
- index `(organization_id, vehicle_id)`;
- index `(vehicle_id, sort_order)`;
- check: `main` має `name IS NULL`, `is_public = true`, `sort_order = 0`; `description` дозволений;
- check: `custom` має непорожню `name`.

`cover_item_id` перевіряється сервісом: item активний, має `type = image` і належить цій самій
галереї, організації та автомобілю. Циклічний FK реалізується засобами Drizzle (через getter або окремий блок `foreignKey`) для збереження type safety без потреби у сирих міграціях. Залишати невалідоване довільне UUID не можна.

### Таблиця `vehicle_gallery_items`

| Колонка           | Тип                           | Правила |
| ----------------- | ----------------------------- | ------- |
| `id`              | uuid PK                       | `gen_random_uuid()` |
| `organization_id` | uuid NOT NULL                 | FK `organizations`, tenant scope |
| `vehicle_id`      | uuid NOT NULL                 | денормалізовано для flat org/vehicle scope |
| `gallery_id`      | uuid NOT NULL                 | FK `vehicle_galleries`, `ON DELETE RESTRICT` |
| `type`            | `vehicle_gallery_item_type`   | у цьому епіку лише `image` |
| `file_key`        | varchar(512) NOT NULL         | об'єкт у MinIO |
| `original_name`   | varchar(255) NOT NULL         | очищене ім'я завантаженого файла |
| `mime_type`       | varchar(128) NOT NULL         | sniffed MIME |
| `size_bytes`      | bigint NOT NULL               | розмір оригіналу |
| `caption`         | text NULL                     | необов'язковий підпис |
| `sort_order`      | integer NOT NULL DEFAULT 0    | порядок у галереї |
| audit fields      | стандартні                    | `created_by`, `updated_by`, timestamps, soft-delete |

Індекси:

- `(organization_id, vehicle_id, gallery_id)`;
- `(gallery_id, sort_order)`;
- partial unique `(gallery_id, sort_order) WHERE deleted_at IS NULL` бажаний, якщо reorder
  реалізовано через безконфліктну двофазну зміну позицій.

Стару таблицю та Drizzle-модель `vehicle_photos` видаляємо. Дані не мігруються.

## 5. Інваріанти та конкурентність

1. Кожен запит фільтрується за `organization_id`, `vehicle_id`, активністю автомобіля, галереї та item.
2. Чужий автомобіль, галерея або item повертає `404`, не `403`.
3. `organization_id` і `vehicle_id` на дочірніх записах беруться з серверного контексту.
4. Create vehicle + create main gallery є однією транзакцією.
5. Upload використовує PostgreSQL Advisory Lock по `gallery_id`, щоб гарантувати відсутність race conditions і паралельні запити не перевищили 30 активних items.
6. Reorder приймає повний набір активних item IDs конкретної галереї. Дублікати, пропуски та чужі
   IDs відхиляються.
7. Move блокує source і target gallery у стабільному порядку, перевіряє target limit, оновлює
   `gallery_id` та `sort_order` в одній транзакції.
8. Зміна cover, move, delete item і delete gallery конкурентно безпечні та не залишають
   `cover_item_id`, який посилається на неактивний або чужий item.
9. Публічний download перевіряє весь ланцюжок:
   `vehicle active/public → gallery active/public → item active`.
10. Authenticated download додатково перевіряє active org і відповідність URL-параметрів. Пошук item
    лише за глобальним `itemId` без org/vehicle/gallery scope заборонений.

## 6. Правила обкладинки

**Явна обкладинка** — активний `cover_item_id`, встановлений користувачем.

**Ефективна обкладинка**:

1. явна активна обкладинка;
2. інакше перший активний item за `sort_order`, `created_at`;
3. інакше `null`.

Додаткові правила:

- set cover приймає лише активне зображення тієї ж галереї;
- `null` скидає явний вибір і повертає автоматичний fallback;
- reorder не змінює явну обкладинку;
- якщо явної обкладинки немає, reorder може змінити ефективну обкладинку;
- delete/move явної обкладинки очищує `cover_item_id`, але не записує ID fallback-фото;
- для списків автомобілів використовується ефективна обкладинка `main`-галереї;
- приватність custom-галерей не впливає на адмінський перегляд, але їхні обкладинки не можуть
  представляти автомобіль у загальному списку.

## 7. API

Нижче наведено цільові маршрути. Назви response-схем можуть уточнюватися в тікеті shared-контрактів,
але семантика та scope є зафіксованими.

### Authenticated galleries

**`GET /api/v1/vehicles/:vehicleId/galleries`**

Повертає всі активні галереї доступного автомобіля, включно з items, ефективною обкладинкою та
лімітом `maxItems = 30`. Порядок: `main`, потім custom за sequence.

**`POST /api/v1/vehicles/:vehicleId/galleries`**

```json
{
  "name": "Після ремонту",
  "description": "Фінальний стан автомобіля",
  "isPublic": false
}
```

Створює лише `custom`; `isPublic` default false.

**`PATCH /api/v1/vehicles/:vehicleId/galleries/:galleryId`**

Для custom редагує `name`, `description`, `isPublic`. Для `main` дозволяє змінити лише
`description`; спроба передати `name` або `isPublic` повертає `MAIN_GALLERY_IMMUTABLE`.

**`DELETE /api/v1/vehicles/:vehicleId/galleries/:galleryId`**

Soft-delete custom-галереї та її активних items. Для `main` заборонено.

**`PUT /api/v1/vehicles/:vehicleId/galleries/:galleryId/cover`**

```json
{ "itemId": "uuid-or-null" }
```

Встановлює або скидає явну обкладинку.

### Authenticated items

**`POST /api/v1/vehicles/:vehicleId/galleries/:galleryId/items`**

`multipart/form-data`: `file`, optional `caption`. Новий item додається в кінець галереї.

**`PATCH /api/v1/vehicles/:vehicleId/galleries/:galleryId/items/:itemId`**

```json
{ "caption": "Автомобіль після фарбування" }
```

Редагує підпис.

**`PATCH /api/v1/vehicles/:vehicleId/galleries/:galleryId/items/order`**

```json
{ "itemIds": ["uuid-1", "uuid-2"] }
```

Масив має містити рівно всі активні items галереї.

**`POST /api/v1/vehicles/:vehicleId/galleries/:galleryId/items/:itemId/move`**

```json
{ "targetGalleryId": "uuid" }
```

Переносить item у кінець іншої галереї цього автомобіля.

**`DELETE /api/v1/vehicles/:vehicleId/galleries/:galleryId/items/:itemId`**

Soft-delete item. Доступно `coordinator` і `volunteer`.

**`GET /api/v1/vehicles/:vehicleId/galleries/:galleryId/items/:itemId/download`**

Приватний download з org scope. Cache-Control: private.

### Public API

**`GET /api/v1/public/:orgId/vehicles/:vehicleId`**

Поле `photos` замінюється на:

```json
{
  "galleries": [
    {
      "id": "uuid",
      "kind": "main",
      "name": "Основна",
      "description": null,
      "sortOrder": 0,
      "coverItemId": "uuid-or-null",
      "items": [
        {
          "id": "uuid",
          "type": "image",
          "mimeType": "image/jpeg",
          "caption": null,
          "sortOrder": 0
        }
      ]
    }
  ]
}
```

Повертаються лише активні `is_public = true` галереї активного публічного автомобіля.

**`GET /api/v1/public/vehicle-gallery-items/:itemId/download`**

Повертає файл лише після перевірки всього public visibility chain. Для приватного item завжди `404`.

### Vehicle responses

List/detail response автомобіля отримує nullable summary ефективної обкладинки `main`-галереї:

```json
{
  "mainGalleryCover": {
    "itemId": "uuid",
    "mimeType": "image/jpeg"
  }
}
```

Це дозволяє спискам показувати обкладинку без завантаження всіх галерей і без N+1 запитів (реалізується через `db.$with` CTE або `LATERAL JOIN` з `DISTINCT ON` на рівні БД).

## 8. UX

### Картка автомобіля

- секція «Галереї» показує `main` першою, потім додаткові галереї;
- для кожної галереї видно назву, опис, статус публічності, кількість фото та обкладинку;
- `viewer` не бачить mutation controls;
- `coordinator` і `volunteer` можуть відкрити модалку керування;
- empty state `main`: «Фото автомобіля ще не додано»;
- створення custom-галереї відбувається з картки автомобіля.

### Модалка галереї

- редагування назви, опису та публічності для custom;
- для `main` назва й публічність read-only, опис можна редагувати;
- drag-and-drop для сортування фото (рекомендується `@dnd-kit/core` з кастомним grid замість вбудованого списку `Upload` з Ant Design);
- завантаження одного чи кількох фото з валідацією ліміту 30;
- редагування необов'язкового підпису;
- вибір/скидання обкладинки;
- перенесення до іншої галереї автомобіля;
- видалення фото;
- видалення custom-галереї з явним попередженням, що всі її фото також буде видалено;
- жодної серверної обробки або thumbnail generation.

### Форма автомобіля

- `VehicleFormModal` більше не завантажує і не редагує фото;
- після створення автомобіля користувач керує фото на його картці;
- помилки старого ліміту «10 фото» видаляються.

### Публічні сторінки та звіти

- кожна public-галерея є окремою секцією;
- показуються українська назва `main` («Основна»), custom-назва та optional description;
- items показуються за `sort_order`;
- приватні custom-галереї не присутні ані у payload, ані у download;
- якщо публічний звіт або картка у звіті показує автомобіль, для preview використовується
  effective cover його `main`-галереї;
- цей епік не створює нового типу публічного звіту.

## 9. Storage

- Нові object keys:
  `vehicle-galleries/{vehicleId}/{galleryId}/{itemId}/{sanitizedOriginalName}`.
- MIME визначається за вмістом, а не лише за client header.
- Підтримувані MIME лишаються `image/jpeg`, `image/png`, `image/webp`, `image/heic`.
- Оригінальний файл зберігається без ресайзу, конвертації та thumbnail.
- Soft-delete БД не видаляє MinIO object.
- Політика retention/garbage collection для orphaned soft-deleted objects є окремим майбутнім
  рішенням.

## 10. Помилки

Мінімальний набір стабільних error codes:

- `GALLERY_NOT_FOUND`
- `GALLERY_NAME_ALREADY_EXISTS`
- `MAIN_GALLERY_IMMUTABLE`
- `MAIN_GALLERY_DELETE_FORBIDDEN`
- `GALLERY_ITEM_NOT_FOUND`
- `GALLERY_ITEM_LIMIT_EXCEEDED`
- `GALLERY_ORDER_MUST_INCLUDE_ALL_ACTIVE_ITEMS`
- `COVER_ITEM_MUST_BELONG_TO_GALLERY`
- `TARGET_GALLERY_ITEM_LIMIT_EXCEEDED`
- `UNSUPPORTED_GALLERY_ITEM_TYPE`
- чинні `FILE_REQUIRED`, `MAX_UPLOAD_BYTES_EXCEEDED`, `UNSUPPORTED_PHOTO_TYPE` можна уніфікувати
  під item naming у shared-контрактах.

## 11. Тестова стратегія

Обов'язкові сценарії:

- create vehicle атомарно створює рівно одну `main`;
- не можна перейменувати, приватизувати або видалити `main`;
- duplicate custom name case-insensitive відхиляється;
- custom gallery default private;
- upload 30 дозволено, 31-й відхиляється, включно з concurrent upload;
- reorder перевіряє повний набір IDs;
- set/reset/fallback cover;
- delete/move explicit cover очищує `cover_item_id`;
- move зберігає caption, додає item у кінець та перевіряє target limit;
- coordinator і volunteer можуть видалити будь-який item; viewer не може мутувати;
- delete custom gallery soft-delete'ить items, але не `main`;
- чужа org/vehicle/gallery/item повертає 404;
- public vehicle false приховує всі галереї;
- public vehicle true показує `main` і лише public custom;
- direct public download приватного item повертає 404;
- vehicle list/detail повертає effective `main` cover без N+1;
- UI: modal flows, read-only viewer, public sections, відсутність старого photo field.

## 12. Поза обсягом

- Відео та інші типи файлів.
- Генерація thumbnail, image optimization, EXIF normalization, watermark.
- Ручне сортування галерей; у схемі лише резервується `sort_order`.
- Ліміт кількості галерей на автомобіль.
- Окремі share links або токени доступу до приватної галереї.
- Доступ до приватної галереї для незалогінених користувачів.
- Аудит зміни публічності.
- Restore UI/API для видалених галерей або items.
- Фізичне очищення MinIO після soft-delete.
- Міграція/backfill наявних фото.
- Bulk download або ZIP.
- Коментарі, reactions, теги або пошук по підписах.

## 13. Декомпозиція

Робочі тікети, залежності, критичний шлях і можливість паралельної роботи описані у
[`docs/epics/vehicle-galleries/README.md`](vehicle-galleries/README.md).
