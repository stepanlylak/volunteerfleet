# Тікети епіку: Vehicle Galleries (галереї автомобілів)

Декомпозиція епіку [vehicle-galleries.md](../vehicle-galleries.md) на робочі тікети.
Кожен файл `GAL-*.md` є самодостатньою задачею та грає роль issue.

> Повна модель, API, permissions, cover semantics і public visibility описані в
> [епіку](../vehicle-galleries.md).
> Агентний процес — у [agent-workflow.md](../../agent-workflow.md), git/PR-конвенції —
> у [contributing.md](../../contributing.md).

## Наскрізні інваріанти

- org scope на кожному gallery/item query; чужі сутності повертають 404;
- `main` створюється атомарно з авто; не видаляється, не перейменовується і не приватизується;
- фактична public visibility: `vehicle.isPublic && gallery.isPublic`;
- максимум 30 активних items на галерею, конкурентно безпечно;
- soft-delete не видаляє MinIO object;
- `coordinator` і `volunteer` можуть керувати будь-якими фото, `viewer` лише читає;
- authenticated/public download перевіряють повний ownership/visibility chain.

## Індекс

| #                   | Назва                                          | Фаза | Залежності                  | Статус |
| ------------------- | ---------------------------------------------- | :--: | --------------------------- | ------ |
| [GAL-1](GAL-1.md)   | Shared-контракти галерей                       |  0   | —                           | done   |
| [GAL-2](GAL-2.md)   | Схема БД, міграції та relations                |  0   | GAL-1                       | done   |
| [GAL-3](GAL-3.md)   | Main gallery invariant + Gallery CRUD          |  1   | GAL-2                       | done   |
| [GAL-4](GAL-4.md)   | Gallery items: upload, read, caption, download |  1   | GAL-3                       | done   |
| [GAL-5](GAL-5.md)   | Reorder, cover, move і soft-delete             |  1   | GAL-4                       | done   |
| [GAL-6](GAL-6.md)   | Public API та visibility chain                 |  1   | GAL-5                       | done   |
| [GAL-7](GAL-7.md)   | Effective main cover у vehicle responses       |  1   | GAL-5                       | done   |
| [GAL-8](GAL-8.md)   | Галереї на картці авто та базова модалка       |  2   | GAL-3, GAL-4                | todo   |
| [GAL-9](GAL-9.md)   | Повне керування фото у модалці                 |  2   | GAL-5, GAL-8                | todo   |
| [GAL-10](GAL-10.md) | Public UI та обкладинки у списках              |  2   | GAL-6, GAL-7                | todo   |
| [GAL-11](GAL-11.md) | Видалення legacy photo flow і cleanup          |  2   | GAL-4, GAL-9, GAL-10        | todo   |
| [GAL-12](GAL-12.md) | Наскрізна регресія та документація             |  3   | GAL-6, GAL-7, GAL-9, GAL-11 | todo   |

## Критичний шлях

GAL-1 → GAL-2 → GAL-3 → GAL-4 → GAL-5 → GAL-6 → GAL-10 → GAL-11 → GAL-12.

## Можна паралелити

- GAL-6 і GAL-7 після GAL-5.
- GAL-8 можна почати після basic gallery/item API з GAL-3/GAL-4.
- GAL-9 після GAL-5 і GAL-8, паралельно з public UI.
- GAL-10 після public API та main-cover response.
- GAL-12 виконується після функціонального cleanup; backend regression для GAL-6/GAL-7 можна
  готувати паралельно з frontend GAL-9/GAL-10.
