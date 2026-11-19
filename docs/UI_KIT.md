# UI-кит и соглашения «Ритм.»

Главный документ — `SPEC.md`. Здесь — как пользоваться готовым фундаментом.

## Данные
- Хуки react-query: `src/lib/queries/*` (barrel `@/lib/queries`). Типы `Task`, `Project`, `Overview` и др. реэкспортируются оттуда. Перед работой прочитай хуки своих сущностей.
- Задача из API несёт вычисленные поля: `overdue`, `view` (`today|week|later|inbox|null`), `subtasks_total`, `subtasks_done`. `GET /tasks/:id` отдаёт `subtasks[]`.
- `/tasks?view=...` — только верхний уровень и только невыполненные (если не передан `done`). Выполненные — `done=true`.
- Update-схемы zod сделаны хелпером `patch()` — не используй `.partial()` на create-схемах (zod 4 подставит дефолты и затрёт данные).
- Прогресс проектов и целей — по задачам верхнего уровня.
- Моменты событий в UTC ISO; `/events?from=YYYY-MM-DD&to=YYYY-MM-DD` — локальные сутки.
- Даты: `src/shared/dates.ts` (`todayStr`, `weekRange`, `weekDays`, `bucketOf`, `isOverdue`), `date-fns` + `ru`, неделя с понедельника.
- Константы: `src/lib/ui-constants.ts` — `ACCENT_COLORS`, `PALETTE`, `EVENT_TYPE_COLORS`, `EVENT_TYPE_LABELS`, `BUCKET_LABELS`, `PRIORITY_LABELS`, `PROJECT_TYPE_INFO`.
- `src/lib/storage.ts` — `readStorage/writeStorage` (try/catch). `src/lib/hooks/use-debounced.ts`.

## Компоненты (`import { ... } from "@/components/ui"`)
- `Card` — `variant: "default"|"accent"|"peach"`, `padded` (true).
- `CardHeader` — `icon`, `title`, `subtitle`, `action`, `tone: "default"|"onColor"` (для accent/peach).
- `Button` — `variant: primary|secondary|ghost|danger`, `size: sm|md`, `icon`. `buttonClasses(variant,size)`.
- `IconButton` — `label` (обязателен), `size`, `variant`, `active`.
- `Pill`/`Chip` — `active`, `color` (точка), `icon`, `onClick`, `size`.
- `Segmented<T>` — `options:{value,label,icon?}[]`, `value`, `onChange`, `size`, `fullWidth`.
- `Input`, `Textarea`, `Select` (children `<option>`), `DateInput` (YYYY-MM-DD), `TimeInput` (HH:MM), `Field` (`label`, `hint`).
- `Checkbox` — `checked`, `onChange(checked)`, `color`, `size=22`, `label`, `aria-label`. Круглый, анимированный.
- `ProgressBar` — `value` 0–100, `color`, `height=6`, `onColor`. `ProgressRing` — `value`, `size`, `stroke`, `color`, `children`.
- `Modal` — `open`, `onClose`, `title`, `width=520`. `Sheet` — `open`, `onClose`, `title`, `actions`, `width=440` (боковая панель справа).
- `Popover` — `trigger`, `children` (узел или `(close)=>node`), `align`, `side`. `Menu` — `trigger`, `items: ({label,icon?,onSelect,danger?,hint?}|"divider")[]`.
- `EmptyState` — `text`, `onClick`, `icon`, `compact`. `PageHeader` — `title`, `subtitle`, `actions` (TopBar выводится справа автоматически — используй PageHeader на каждой странице).
- `Kbd`, `Skeleton` (размер через className). `useToast()` → `{show, success, error}`.

## Оболочка (`@/components/shell`)
- `useQuickCreate().open("task"|"event"|"note"|"project"|"goal", defaults?)` — модалки создания. Defaults типизированы (`Partial<TaskCreate>` и т.д.), лишние поля (section_id, goal_id) пробрасываются. После сохранения тост и инвалидация.
- `useCommandPalette()` → `{open,setOpen,toggle}`. `useFocusTimer()` → `{status, remainingSec, progress, start({taskId?}), pause, resume, stop}`.
- `useTheme()` из `@/lib/hooks`.
- Глубокие ссылки из палитры: `/tasks?task=<id>`, `/projects/<id>`, `/notes?note=<id>`, `/calendar?date=YYYY-MM-DD` — страницы обязаны их обрабатывать.
- Отступ под нижнюю панель уже есть в AppShell.

## Tailwind-классы токенов
`bg-bg bg-surface bg-surface-2 text-fg text-fg-sub border-line bg-accent text-accent bg-accent-soft text-danger text-success`, `rounded-card` (20px), `rounded-field` (12px), `shadow-card`, `shadow-pop`, анимации `.anim-fade .anim-pop .anim-slide-in`, зачёркивание `<span className="strike" data-done={done}>`.

## Правила для агентов
- Только свои файлы. Не меняй `src/server/**`, `src/shared/**`, `src/app/api/**`, `src/components/ui/**`, `src/components/shell/**`, `src/lib/**`, `package.json`, `SPEC.md`. Нужна правка в общем — опиши в отчёте, не делай.
- Dev-сервер уже запущен на `http://localhost:3000`. Не запускай второй и не запускай `npm run build`.
- `npx tsc --noEmit` / `npm run lint`: важны ошибки в ТВОИХ файлах; ошибки в чужих папках могут быть от параллельно работающих агентов — игнорируй.
- Тестовые данные, созданные при проверке, удаляй через API. Не делай git commit.
- Качество: аккуратно, воздушно, как в SPEC; пустые состояния и состояния загрузки (Skeleton); оптимистичность там, где хуки её дают; работает на ширине 375px без горизонтального скролла; тёмная тема.
