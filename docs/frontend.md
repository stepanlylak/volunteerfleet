# Фронтенд

SPA на React + Vite. Стек: React 18 + TypeScript, Ant Design v5, TanStack Query v5, Zustand v4,
react-router v6, zod (спільні схеми), dayjs (`locale/uk`), axios. Розподіл стану — [ADR-021](architecture-decisions.md#adr-021-розподіл-стану-на-клієнті-tanstack-query-server-state--zustand-ui-state).

## Bootstrap

```tsx
// src/main.tsx
dayjs.locale('uk');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ConfigProvider locale={ukUA} theme={theme}>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </ConfigProvider>,
);
```

## Маршрутизація

Три контури в одному `router.tsx`:

- **Back-office** під `AuthGuard` + `AppLayout`: `/dashboard`, `/vehicles`, `/vehicles/:id`, `/expenses`,
  `/reports` (index, `vehicle/:id`, `funding/:id`), `/admin/*` під `RoleGuard roles={['admin']}`
  (`users`, `dictionaries`).
- **Публічний** під `PublicLayout` (без сайдбару/хедера з користувачем): `/public/vehicles/:slug`,
  `/public/reports/funding/:id`.
- **Помилки:** `/403`, `*` (404).

`AuthGuard` редіректить на `/login` без авторизації; `RoleGuard` веде на `/403` за невідповідної ролі.

## Лейаут

`Layout` + `Layout.Sider` (collapsible). Sidebar Menu: Dashboard, Vehicles, Expenses, Reports і (для
admin) Admin. Header: ім'я користувача + «Вийти». Активний пункт меню — за `useLocation()`.

## Стан

### Серверний стан — TanStack Query

Хуки в `src/hooks/` обгортають `src/api/`:

```ts
export function useVehicles(params: VehiclesQuery) {
  return useQuery({ queryKey: ['vehicles', params], queryFn: () => vehiclesApi.list(params) });
}
export function useCreateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: vehiclesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  });
}
```

### UI-стан — Zustand

`auth.store` (`user`, `accessToken`, `setAuth`, `clear`) і `ui.store` (відкриті модалки тощо).
Auth-store **не персиститься** в localStorage із міркувань безпеки; після перезавантаження робиться тихий
`refresh` ([ADR-014](architecture-decisions.md#adr-014-jwt-access-у-памяті--refresh-у-httponly-cookie-з-ротацією)).

## HTTP-клієнт

```ts
// src/api/client.ts
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // '/api/v1' — через Vite-проксі (same-origin)
  withCredentials: true, // для cookie
});

http.interceptors.request.use((cfg) => {
  const token = useAuth.getState().accessToken;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// 401 → тихий refresh → retry; якщо refresh теж 401 → clear + redirect на /login
http.interceptors.response.use((r) => r, async (err) => { /* refresh-once логіка */ });
```

`VITE_API_URL` лишається відносним (`/api/v1`), щоб клієнт ходив через Vite dev-proxy і cookie були
first-party ([ADR-015](architecture-decisions.md#adr-015-access-токен-дублюється-в-httponly-cookie--vite-проксі-для-нативних-завантажень-браузера)).

## Форми

Ant Design `<Form>` з валідацією спільною zod-схемою через адаптер `zodValidator` (`src/utils/zod-antd.ts`):

```tsx
<Form.Item name="brand" label="Марка"
  rules={[{ validator: zodValidator(vehicleCreateSchema.shape.brand) }]}>
  <Input />
</Form.Item>
```

При сабміті — повний `safeParse`; помилки бекенда (`details: [{ path, message }]`) мапляться у
`form.setFields` тим самим хелпером, що й локальні zod-issues. Форми редагування авто, витрати,
документа, користувача й елементів довідників — у `src/modals/`. Універсальне поле прикріплення файлів —
`components/files/FileAttachmentField.tsx`.

## Звіти й друк

Звіт — окрема сторінка з кнопкою «Зберегти як PDF», що викликає `window.print()` ([ADR-018](architecture-decisions.md#adr-018-звіти-через-print-stylesheet-без-pdf-бібліотеки)).
`src/styles/print.css` (`@media print`) ховає все, крім `.print-area`, прибирає тіні й фони таблиць,
задає `@page A4`. Toolbar і підказка друку мають клас `.no-print`. Публічні версії звітів рендеряться тим
самим компонентом у режимі `publicMode`.

```css
@media print {
  @page { size: A4 portrait; margin: 18mm 12mm; }
  body * { visibility: hidden; }
  .print-area, .print-area * { visibility: visible; }
  .print-area { position: absolute; top: 0; left: 0; width: 100%; }
  .no-print { display: none !important; }
}
```

## i18n, темізація, доступність

- **Лише українська** — без бібліотеки i18n; рядки UI у JSX, числа через `Intl.NumberFormat('uk-UA')`,
  дати через `dayjs(...).format('DD.MM.YYYY')` (утиліта в `src/utils/format.ts`).
- **Темізація** — мінімальна, через `ConfigProvider` `theme` (`src/styles/theme.ts`): `colorPrimary`,
  `borderRadius`, дрібні токени таблиць.
- **Доступність** — спираємось на ARIA Ant Design і стандартну клавіатурну навігацію; контраст не нижче AA.

## Продуктивність

Code-split на рівні роутів (`React.lazy`, особливо `/admin/*` і звіти); індивідуальний імпорт іконок Ant
Design; `loading="lazy"` для зображень.

## Зворотний зв'язок і помилки

Глобальний `ErrorBoundary`; `message.*` для toast-нотифікацій; `Empty` для пустих списків; `Spin`/
`Skeleton` для завантаження; на 5xx — модал «Сталася помилка, спробуйте пізніше».

## Поза межами першої версії

SSR/Next.js, PWA/offline, темна тема, drag-and-drop сортування (поза галереєю фото), Storybook.
