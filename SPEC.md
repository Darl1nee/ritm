# Ритм. — личная система задач, проектов и календаря

Личное веб-приложение одного пользователя. Минимализм, воздух, «хочется вести жизнь в нём».
Позже: MCP-сервер для ИИ-агентов и встроенный ассистент — поэтому вся логика живёт в слое сервисов,
который одинаково вызывают UI (через REST) и MCP.

## Стек (фиксирован, новые зависимости не добавлять без согласования)

- Next.js 15 (App Router) + TypeScript (strict) + Tailwind CSS v4
- SQLite: `better-sqlite3` + `drizzle-orm` (+ `drizzle-kit` для миграций). Файл БД: `data/ritm.db` (в .gitignore)
- Валидация: `zod` (схемы в `src/shared/schemas.ts`, общие для API, UI и будущего MCP)
- Клиентские данные: `@tanstack/react-query`
- Иконки: `lucide-react` (stroke 1.75, размер 18 в меню)
- Даты: `date-fns` + локаль `ru`, неделя с понедельника
- Палитра команд: `cmdk`
- Перетаскивание: `@dnd-kit/core`, `@dnd-kit/sortable`
- ID: `nanoid`; классы: `clsx`
- Тесты: `vitest`

## Структура

```
src/
  app/
    layout.tsx                 # html, шрифты, Providers (QueryClient, тема)
    (app)/layout.tsx           # оболочка: Sidebar + TopBar + BottomBar
    (app)/page.tsx             # Обзор
    (app)/tasks/page.tsx
    (app)/projects/page.tsx
    (app)/projects/[id]/page.tsx
    (app)/calendar/page.tsx
    (app)/notes/page.tsx
    (app)/settings/page.tsx
    api/v1/**/route.ts         # REST, тонкие обёртки над services
  server/
    db/schema.ts  db/client.ts  db/seed.ts
    services/*.ts              # ВСЯ бизнес-логика; чистые функции (db, input) → data
  shared/
    schemas.ts                 # zod-схемы + выведенные типы
    dates.ts                   # хелперы дат (сегодня, неделя, бакеты)
  lib/
    api.ts                     # fetch-клиент
    queries/*.ts               # react-query хуки по сущностям
  components/
    ui/*                       # UI-кит
    shell/*                    # Sidebar, TopBar, BottomBar, CommandPalette, QuickCreate, FocusTimer
    overview/* tasks/* projects/* calendar/* notes/*
```

## Модель данных

Все таблицы: `id text pk (nanoid)`, `created_at`, `updated_at` (ISO-строки). Даты без времени — `YYYY-MM-DD`,
моменты — ISO с таймзоной.

- **categories**: name, color (hex), sort. Сид: Работа `#2e5eff`, Личное `#f08c3a`, Деньги `#1fae6b`, Здоровье `#e5484d`, Учёба `#8e5cf7`.
- **projects**: title, type (`project|trip|content|learning`), status (`active|paused|done|archived`),
  description, color, emoji (nullable), start_date, due_date (nullable).
- **project_sections**: project_id, title, sort. Колонки доски / этапы / модули. При создании проекта
  создаются по шаблону типа:
  - project: Бэклог, В работе, Готово
  - trip: Маршрут, Брони, Сборы
  - content: Идеи, Сценарий, Съёмка, Монтаж, Публикация
  - learning: Модуль 1, Модуль 2, Модуль 3
- **goals**: title, description, target_date (nullable), category_id (nullable), status (`active|done|archived`).
- **tasks**: title, notes, done (bool), completed_at, bucket (`inbox|today|week|later`), due_date, due_time,
  duration_min, priority (0–3), category_id, project_id, section_id, goal_id, parent_id (подзадачи), sort.
- **events**: title, type (`meeting|sport|personal|focus|other`), start_at, end_at, all_day, location, notes, project_id.
- **notes**: title, body (markdown), kind (`note|idea`), project_id, pinned.
- **focus_sessions**: started_at, ended_at, duration_min, task_id (nullable).
- **settings**: key (pk), value (json). Ключи: `theme` (`light|dark|system`), `accent` (hex), `focus_goal_min` (120), `focus_length_min` (25), `user_name`.

### Правила бакетов задач (в `shared/dates.ts`, покрыть тестами)
Для не выполненных задач:
- **Сегодня**: bucket=`today` ИЛИ due_date ≤ сегодня (просроченные тоже здесь, помечены).
- **На неделе**: не «сегодня» И (bucket=`week` ИЛИ due_date в пределах текущей недели пн–вс).
- **Потом**: всё остальное, кроме входящих.
- **Входящие**: bucket=`inbox`, без due_date и без project_id.

## REST API (`/api/v1`)

JSON, ошибки `{ error: string }` со статусом 400/404. Валидация zod.

- `GET/POST /tasks` (фильтры: `view=today|week|later|inbox|all`, `project_id`, `category_id`, `goal_id`, `done`, `from`, `to`), `GET/PATCH/DELETE /tasks/:id`, `POST /tasks/:id/toggle`, `POST /tasks/reorder`
- `GET/POST /projects` (фильтры `type`, `status`, `q`), `GET/PATCH/DELETE /projects/:id` (GET отдаёт секции, задачи, прогресс), `POST /projects/:id/sections`, `PATCH/DELETE /sections/:id`
- `GET/POST /goals`, `PATCH/DELETE /goals/:id`
- `GET/POST /events` (`from`, `to` обязательны для GET), `PATCH/DELETE /events/:id`
- `GET/POST /notes` (`kind`, `q`, `project_id`), `GET/PATCH/DELETE /notes/:id`
- `GET/POST /categories`, `PATCH/DELETE /categories/:id`
- `GET/POST /focus` (`POST` = записать завершённую сессию), `GET /focus/today`
- `GET/PATCH /settings`
- `GET /overview` — всё для Обзора одним запросом: задачи сегодня (счётчики done/total, просрочено),
  фокус сегодня (минуты, подходы, цель), ближайшие события сегодня, загрузка по дням недели, активные проекты с прогрессом.
- `GET /search?q=` — по задачам, проектам, заметкам, событиям (для палитры команд).

## Дизайн-система

Ощущение: тихо, светло, много воздуха, один акцентный цвет. Бренд: слово «Ритм» + точка акцентного цвета.

### Токены (CSS-переменные на `:root`, тёмная тема через `[data-theme=dark]`)

| токен | светлая | тёмная |
|---|---|---|
| `--bg` | `#f4f5f7` | `#0e0f11` |
| `--surface` | `#ffffff` | `#17181b` |
| `--surface-2` (поля, чипы) | `#f0f1f4` | `#202226` |
| `--fg` | `#16171a` | `#f2f3f5` |
| `--fg-sub` | `#9a9da4` | `#8b8f98` |
| `--line` | `#eaeaee` | `#26282d` |
| `--accent` | `#2e5eff` (меняется в настройках) | `#4b74ff` |
| `--accent-soft` | accent 10% | accent 18% |
| `--danger` | `#e5484d` | `#ff6369` |
| `--success` | `#1fae6b` | `#3dd68c` |

Акценты на выбор: `#2e5eff #7b5cff #1fae6b #f08c3a #e5484d #0fa3a3`.

Цвета типов событий: meeting `#2e5eff`, sport `#1fae6b`, personal `#f08c3a`, focus `#7b5cff`, other `#9a9da4`.

### Формы
- Шрифт: `-apple-system, "SF Pro Text", Inter, "Segoe UI", system-ui, sans-serif`. Цифры — `tabular-nums`.
- Карточки: `--surface`, радиус 20px, без рамки, мягкая тень `0 1px 2px rgba(16,17,26,.04), 0 8px 24px rgba(16,17,26,.04)`, внутренний отступ 20–24px.
- Контролы: высота 36–40px, радиус 12px (поля) / 999px (чипы, сегменты). Поля на `--surface-2`, без рамки.
- Заголовок страницы: 28px / 700, отступ сверху 28px. Подписи: 12–13px `--fg-sub`.
- Акцентные карточки Обзора: синяя (градиент `#2e5eff → #5a7dff` + тонкий точечный узор) и персиковая (`#f7c9a3 → #e47c6b`), текст белый.
- Пустые состояния: пунктирная рамка `--line`, «+» и короткий текст по центру.
- Анимации: 150–200ms ease-out; галочка задачи — заполнение кружка + зачёркивание.

### Оболочка
- **Sidebar** 232px (сворачивается до 72px, состояние в localStorage): логотип; пункты Обзор, Задачи (бейдж = невыполненных на сегодня), Проекты, Календарь, Заметки; внизу Настройки и «Свернуть». Активный пункт — `--accent-soft` фон + текст accent.
- **TopBar** (справа сверху, на уровне заголовка): пилюля с часами (ЧЧ:ММ) и датой «Пн, 16 нояб»; кнопка «Спросить» (пока открывает палитру команд); таймер фокуса — круглый прогресс + `25:00` + play/pause, по завершении пишет `focus_session`.
- **BottomBar** (плавающая, по центру снизу, `position: fixed`): поле «Поиск и команды» с подсказкой `⌘K` и синяя кнопка «+ Создать» (меню: Задача, Событие, Заметка, Проект, Цель).
- **QuickCreate**: модалки создания. Задача: название, бакет, дата/время, категория, проект, приоритет. Enter — сохранить.
- **CommandPalette** (`⌘K`/`Ctrl+K`): поиск по `/search` + действия (создать задачу, перейти в раздел, сменить тему).
- Мобильная ширина (<768px): sidebar скрыт, внизу таб-бар с 5 иконками; кнопка «Создать» над ним.

## Экраны

- **Обзор**: «Доброе утро/день/вечер/ночи, {имя}!»; сетка карточек: Фокус (синяя: минуты сегодня, подходы, цель), Задачи закрыты N/M, Проекты (активные, прогресс-бары), «Дальше сегодня» (ближайшие события и задачи со временем), полоска недели пн–вс с точками загрузки.
- **Задачи**: сверху карточка «Закрыто сегодня» (синяя: N/M, просрочено, всего) и график «Загрузка по дням» (столбики пн–вс, закрыто/осталось); чипы категорий (Все + список + «+ Категория»); группы Сегодня / На неделе / Потом / Входящие с инлайн-«+ Добавить»; блок «Цели» (карточки с прогрессом по привязанным задачам). Задача: кружок-чекбокс, название, мета (дата, категория-точка, проект), клик — боковая панель редактирования (подзадачи, заметки, всё поля). Перетаскивание между группами меняет bucket.
- **Проекты**: поиск, сегмент типов (Все/Проект/Поездка/Контент/Обучение), фильтр статуса, «Новый проект» (выбор типа с описанием). Карточки: эмодзи/цвет, название, тип, прогресс, срок. Страница проекта: шапка, вид «Доска» (колонки = секции, dnd задач) и «Список», заметки проекта.
- **Календарь**: заголовок периода, поиск, сегмент 3 дня / Неделя / Месяц / Список, навигация ‹ Сегодня ›; чипы типов событий (фильтр); сетка часов с красной линией «сейчас»; задачи с due_date+due_time показаны в сетке, без времени — в полосе «весь день»; клик по пустому слоту — создать событие; перетаскивание события меняет время. Справа: мини-календарь месяца, «Сегодня», «На что ушло время» (часы по типам событий за неделю).
- **Заметки**: вкладки Заметки / Идеи, поиск, сетка карточек (закреплённые сверху), редактор markdown на отдельном экране или в панели, автосохранение.
- **Настройки**: имя, тема, акцентный цвет, длина фокуса и цель в день, категории (CRUD).

## Не делаем в MVP
Авторизацию (приложение запускается локально), привычки, финансы, здоровье, Telegram, Google Calendar, ассистент — следующие этапы.

## MCP (сделано)
См. `docs/MCP_SPEC.md` (устройство) и `docs/MCP.md` (подключение).
