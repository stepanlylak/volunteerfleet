# Файли та сховище

Система зберігає два типи бінарних даних у S3-сумісному сховищі: **документи** (чеки, акти, скани) і
**фото авто**. Обґрунтування підходу — [ADR-017](architecture-decisions.md#adr-017-файли--через-s3-сумісне-сховище-minio-з-presigned-завантаженням).

## Сховище — MinIO (S3-сумісне)

- Docker-сервіс `minio` у `docker-compose.yml`; порти `9000` (API) і `9001` (Web Console).
- Креди — `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` з ENV.
- Bucket `volunteerfleet-documents` створюється init-контейнером `minio-init` (через `mc`) і робиться
  приватним (`mc anonymous set none`).
- У проді той самий код працює з AWS S3 / Cloudflare R2 / Backblaze B2 — змінюються лише ENV.

## Клієнт S3

`StorageModule` інжектить `@aws-sdk/client-s3` `S3Client` з `forcePathStyle: true` (обов'язково для MinIO).
DI-токен `S3_CLIENT` винесено в окремий `storage.tokens.ts` (щоб уникнути TDZ у циклічному імпорті
module ↔ service за ESM). `StorageService` надає: завантаження об'єкта (стрімом), генерацію presigned GET
URL з обмеженим TTL, перевірку існування (`headObject`) і (на майбутнє) фізичне видалення.

## Документи: два режими

| Режим        | Що зберігається                       | Сценарій                             |
| ------------ | ------------------------------------- | ------------------------------------ |
| **`upload`** | Файл у MinIO + метадані в `documents` | Чек, скан акту.                      |
| **`link`**   | URL у `documents.url`                 | Посилання на Google Drive / Dropbox. |

Поле `documents.kind` розрізняє режим; CHECK-обмеження в БК гарантують консистентність полів
(див. [database.md](database.md)). Призначення документа (загальний / документ витрати) виводиться з
наявності `expense_id` ([ADR-013](architecture-decisions.md#adr-013-призначення-документа-виводиться-з-expense_id-а-не-зберігається-окремим-полем)).

### Ключі об'єктів

```
documents/{document_uuid}/{sanitized_original_name}
```

`document_uuid` дорівнює `documents.id` (генерується до upload, щоб ключ і запис мали спільний
ідентифікатор). Оригінальна назва санітизується (видаляються `..`, `/`, `\`, control-chars, обрізається).
`documents.file_key` зберігає повний шлях у bucket.

### Обмеження для `upload`

- Максимальний розмір — `MAX_UPLOAD_BYTES` (default 25 MB). Перевищення → `413 PAYLOAD_TOO_LARGE`.
- **MIME-whitelist** + content-sniffing (`file-type`) поверх заголовка `Content-Type` — заголовок клієнта
  не є джерелом довіри. MIME не у whitelist → `415 UNSUPPORTED_MEDIA_TYPE`.

Дозволені типи: `application/pdf`, `image/jpeg|png|webp|heic`, Word/Excel (`.doc/.docx/.xls/.xlsx`),
`text/plain`, `text/csv`.

### Флоу upload

1. Клієнт формує `FormData` (`file` + `name`, `vehicleId?`, `expenseId?`) і шле `POST /documents/upload`.
2. Сервер валідує метадані (zod), sniff-ить MIME з перших кілобайтів, перевіряє розмір.
3. Стрімить файл у MinIO (без буферизації всього файлу в пам'ять), пише запис у `documents`.
4. Повертає `201` з повною репрезентацією документа.

### Флоу link

`POST /documents/link` з JSON (`name`, `url`, `vehicleId?`, `expenseId?`); сервер валідує URL і прив'язку
(мінімум одна), пише `documents` із `kind='link'`.

### Флоу download

`GET /documents/:id/download`:

- `kind='upload'` → presigned GET URL (короткоживучий) → відповідь `302 Found` з `Location`.
- `kind='link'` → `302` на `url`.

Бекенд не стрімить файл сам: presigned-URL дозволяє браузеру забрати файл напряму з MinIO, тож сервер не
стає bottleneck. Для `image/*` UI показує inline-прев'ю через той самий presigned-URL.

## Фото авто

Фото зберігаються в окремій таблиці `vehicle_photos` (а не в `documents`) — [ADR-012](architecture-decisions.md#adr-012-фото-авто--окрема-таблиця-vehicle_photos-а-не-документи):

- key-префікс `vehicle-photos/{vehicleId}/...` у тому самому bucket;
- приймаються лише image-MIME з whitelist; той самий ліміт розміру;
- ліміт **10 активних фото** на авто перевіряється у транзакції з блокуванням рядка авто;
- галерея має ручний порядок (`sort_order`), змінюваний через `PATCH /vehicles/:id/photos/order`;
- завантаження — через `GET /vehicles/:id/photos/:photoId/download` (302 на presigned), а для публічних
  авто — через `GET /public/vehicle-photos/:id/download` з перевіркою `is_public`.

## Soft delete файлів

`DELETE` документа/фото ставить `deleted_at`, але **файл у MinIO лишається**. Адмін може відновити запис.
Фонове прибирання осиротілих об'єктів (cleanup job) — поза межами першої версії.

## Поза межами першої версії

- Шифрування at-rest (SSE-KMS), antivirus-сканування (ClamAV), версіонування файлів.
- Resize/thumbnails (Ant Design `Image` робить базовий preview).
- Bulk upload; cleanup-job для фізичного видалення.
