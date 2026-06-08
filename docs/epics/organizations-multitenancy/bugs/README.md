# Баги епіку Organizations (ORG-1..ORG-17)

Знайдені під час code review. Нумерація незалежна від ORG-тікетів.

| #                                               | Назва                                                  | Знайдено в    | Критичність |
| ----------------------------------------------- | ------------------------------------------------------ | ------------- | ----------- |
| [BUG-1](BUG-1-membership-name-missing.md)       | `memberships` не містить `name` організації            | ORG-5, ORG-14 | medium      |
| [BUG-2](BUG-2-org-create-user-sub.md)           | Створення org падає: `user.userId` замість `user.sub`  | ORG-12        | high        |
| [BUG-3](BUG-3-public-funding-report-404.md)     | Публічний funding report завжди повертає 404           | ORG-11        | high        |
| [BUG-4](BUG-4-photo-download-no-org-check.md)   | Завантаження фото не перевіряє приналежність до org    | ORG-7         | high        |
| [BUG-5](BUG-5-volunteer-sees-delete-buttons.md) | Volunteer бачить кнопки Delete для витрат і документів | ORG-17        | low         |
