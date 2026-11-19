# MCP-сервер «Ритм.» — спецификация

ИИ-агенты (Claude Code, Claude Desktop, позже claude.ai/ChatGPT) подключаются к Ритму по MCP и работают
с задачами, проектами, календарём, заметками и целями. MCP — тонкий слой над `src/server/services/*`.

## Уже готово (не переписывать)
- `src/server/mcp/scopes.ts` — права `tasks|projects|calendar|notes|goals` × `read|write`, `requireScopes()`, `ScopeError`, `READ_ONLY_SCOPES`, `SCOPE_GROUPS` (подписи).
- `src/server/services/mcp-tokens.ts` — `createMcpToken`, `listMcpTokens`, `getMcpToken`, `updateMcpToken`, `revokeMcpToken`, `deleteMcpToken`, `verifyMcpToken`. Тип `McpToken` (без хеша, `scopes: Scope[]`, `active`).
- `src/server/mcp/auth.ts` — `authenticateMcpRequest(db, req)` → `{ok:true, token}` | `{ok:false, response}` (Host/Origin + Bearer).
- `src/middleware.ts`, `src/shared/hosts.ts` — защита Host/Origin.
- Схема: таблицы `mcp_tokens`, `agent_activity`; колонка `source` (`user|agent`, по умолчанию `user`) у tasks, projects, events, notes, goals. Миграция `drizzle/0001_mcp.sql`.
- Пакет `@modelcontextprotocol/sdk@1.32.2` установлен. Используем `McpServer` (`server/mcp.js`, метод `registerTool`, zod-схемы) и `WebStandardStreamableHTTPServerTransport` (`server/webStandardStreamableHttp.js`) в stateless-режиме.

## Эндпоинт
`src/app/api/mcp/route.ts` (`runtime = "nodejs"`, `dynamic = "force-dynamic"`), методы POST/GET/DELETE:
1. `authenticateMcpRequest(getDb(), req)`; при отказе вернуть `response`.
2. На каждый запрос: `createRitmMcpServer({ db, token })` + `new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })`, `server.connect(transport)`, `return transport.handleRequest(req, { authInfo })`.
3. Сервер собирается в `src/server/mcp/server.ts`: `createRitmMcpServer({ db, token, now? })` — чистая фабрика, тестируется без HTTP.

## Поведение инструментов
- Регистрируются **только** инструменты, на которые у ключа есть права (агент не видит лишнего). Внутри обработчика права проверяются ещё раз (`requireScopes`).
- Вход — zod-схемы с `.describe()` на русском для каждого поля (агент читает описания). Даты `YYYY-MM-DD`, время `HH:MM`, моменты ISO 8601 с часовым поясом.
- Описание каждого инструмента — 1–3 предложения: что делает, когда использовать.
- Результат: `content: [{ type: "text", text: JSON.stringify(result) }]`. Компактно: без служебных полей (`sort`, `created_at`, `updated_at`), в задачах — `id, title, done, bucket, view, overdue, due_date, due_time, duration_min, priority, category, project, section_id, goal_id, parent_id, subtasks_total, subtasks_done, notes` (категория и проект — `{id, name}`/`{id, title}`, а не только id). Списки ограничены (`limit`, по умолчанию 50, макс 200).
- Ошибки (`ScopeError`, `NotFoundError`, `ZodError`, `RangeError`) — НЕ бросать наружу, а возвращать `{ isError: true, content: [{type:"text", text: "<понятное сообщение>"}] }`.
- `annotations`: чтение — `readOnlyHint: true`; удаление — `destructiveHint: true`; остальные записи — `readOnlyHint: false, destructiveHint: false`; у всех `openWorldHint: false`. Задай `title` (по-русски).
- Каждая запись: созданным сущностям проставить `source = "agent"`; записать в журнал (см. ниже).

## Инструменты

### Без прав
- `get_context` — текущее время (ISO), локальная дата, день недели по-русски, часовой пояс сервера, границы текущей недели (пн–вс), имя пользователя, список выданных ключу прав. Рекомендуется вызывать первым.

### Чтение
| инструмент | права | вход |
|---|---|---|
| `get_overview` | tasks:read (+ блоки календаря/проектов только при calendar:read/projects:read) | — |
| `list_tasks` | tasks:read | `view?` (today/week/later/inbox/all), `project_id?`, `category_id?`, `goal_id?`, `done?`, `from?`, `to?`, `limit?` |
| `get_task` | tasks:read | `id` (с подзадачами) |
| `list_categories` | tasks:read | — |
| `list_projects` | projects:read | `type?`, `status?`, `q?` |
| `get_project` | projects:read | `id` → проект, секции, прогресс; задачи — только если есть tasks:read |
| `list_events` | calendar:read | `from`, `to` (даты, макс диапазон 62 дня) |
| `find_free_time` | calendar:read | `from`, `to`, `min_duration_min` (деф. 30), `day_start` (деф. "09:00"), `day_end` (деф. "21:00") → свободные окна по дням с учётом событий (и задач со временем, если есть tasks:read). Не предлагать время в прошлом. |
| `list_notes` | notes:read | `kind?`, `q?`, `project_id?`, `limit?` (тело заметки обрезать до 300 символов) |
| `get_note` | notes:read | `id` (полный текст) |
| `list_goals` | goals:read | `status?` (с прогрессом) |
| `search` | любое :read | `q` → результаты только по разделам, на которые есть права чтения |

### Запись
| инструмент | права | заметки |
|---|---|---|
| `create_task` | tasks:write | все поля задачи; `subtasks?: string[]` — сразу создать подзадачи |
| `update_task` | tasks:write | `id` + любые поля (null очищает дату/время/проект и т.п.) |
| `complete_task` | tasks:write | `id`, `done` (деф. true) |
| `delete_task` | tasks:write | destructive; удаляет с подзадачами |
| `create_project` | projects:write | `title`, `type`, `description?`, `emoji?`, `color?`, `start_date?`, `due_date?` → проект с секциями по шаблону типа |
| `update_project` | projects:write | `id` + поля (в т.ч. `status`) |
| `add_section` | projects:write | `project_id`, `title` |
| `rename_section` | projects:write | `id`, `title` |
| `plan_project` | projects:write + tasks:write | `project_id`, `tasks: [{ title, section?: <название колонки>, section_id?, due_date?, due_time?, duration_min?, priority?, category_id?, notes?, subtasks?: string[] }]` (1–100). Колонки, которых нет, создаются по названию. **Одна транзакция**: ошибка — ничего не создано. Возвращает созданные задачи и колонки. |
| `create_event` | calendar:write | `title`, `type`, `start_at`, `end_at`, `all_day?`, `location?`, `notes?`, `project_id?` |
| `update_event` | calendar:write | `id` + поля |
| `delete_event` | calendar:write | destructive |
| `create_note` | notes:write | `title`, `body`, `kind?`, `project_id?`, `pinned?` |
| `update_note` | notes:write | `id` + поля; `append_body?` — дописать текст в конец с новой строки |
| `delete_note` | notes:write | destructive |
| `create_goal` | goals:write | `title`, `description?`, `target_date?`, `category_id?` |
| `update_goal` | goals:write | `id` + поля (в т.ч. `status`) |

Удаление проектов, целей и категорий через MCP не предусмотрено (намеренно).

### Промпты (MCP prompts)
- `plan_week` — «Спланируй мою неделю»: инструкция агенту посмотреть контекст, задачи недели, события и свободное время и предложить план, спросив подтверждение перед изменениями.
- `break_down_project` (аргумент `project`) — «Разбей проект на задачи»: найти проект, предложить структуру и после подтверждения создать через `plan_project`.

### Инструкции сервера (`instructions` в McpServer)
Коротко на русском: что такое Ритм; бакеты задач (inbox/today/week/later) и правила попадания по дате; форматы дат; «начни с get_context»; «перед созданием поищи, чтобы не плодить дубли»; «для планирования используй find_free_time»; «массовые изменения (больше 5 сущностей) и удаления — сначала опиши план пользователю и получи согласие»; «все действия видны пользователю в журнале и могут быть отменены».

## Журнал действий агента
`src/server/services/activity.ts`:
- `logActivity(db, { token_id, tool, entity_type, entity_id, action, summary, before?, after? })` — снимки строк БД как JSON. Для задачи снимок `delete` включает подзадачи (`{ task, subtasks: [] }`).
- `summary` по-русски: «Создана задача «Купить билеты»», «Задача «…» перенесена на 20 нояб», «Удалено событие «…»», «План проекта «…»: 12 задач».
- `listActivity(db, { limit=50, before? })` → `ActivityItem[]`: поля строки + `token_name` (или «удалённый ключ»), `can_undo`.
- `undoActivity(db, id)`:
  - create → удалить сущность (task — с подзадачами; project — через сервис удаления проекта; section — через сервис);
  - update → вернуть поля из `before`, которые отличаются от `after` (если сущность существует);
  - delete → восстановить из снимка с тем же id (для task — вместе с подзадачами);
  - нельзя отменить: уже отменено; сущность удалена (для create/update); сущность уже существует (для delete) → `RangeError` с понятным текстом. `can_undo` в списке считается по тем же правилам.
  - выставляет `undone_at`.
- Операции записи + журнал — в одной транзакции.

## REST для UI (тонкие обёртки, как остальные `/api/v1`)
- `GET /api/v1/mcp/info` → `{ url: "<origin запроса>/api/mcp", groups: [{ id, label }], scopes: [{ id, group, level, label }] }`
- `GET /api/v1/mcp/tokens` → `McpToken[]`
- `POST /api/v1/mcp/tokens` `{ name, scopes }` → `201 { token, record }` (открытый ключ — только здесь)
- `PATCH /api/v1/mcp/tokens/:id` `{ name?, scopes? }` → `McpToken`
- `POST /api/v1/mcp/tokens/:id/revoke` → `McpToken`
- `DELETE /api/v1/mcp/tokens/:id` → `{ ok: true }` (только отозванные; иначе 400)
- `GET /api/v1/activity?limit=&before=` → `ActivityItem[]`
- `POST /api/v1/activity/:id/undo` → `ActivityItem` (нельзя — 400 `{error}`)

`ActivityItem`: `{ id, token_id, token_name, tool, entity_type, entity_id, action, summary, created_at, undone_at, can_undo }`.

## Подключение (для docs/MCP.md и экрана настроек)
- Claude Code: `claude mcp add --transport http ritm http://localhost:3000/api/mcp --header "Authorization: Bearer <ключ>"`
- Claude Desktop (`claude_desktop_config.json`, через мост `mcp-remote`):
  ```json
  { "mcpServers": { "ritm": { "command": "npx", "args": ["-y", "mcp-remote", "http://localhost:3000/api/mcp", "--header", "Authorization:${RITM_AUTH}"], "env": { "RITM_AUTH": "Bearer <ключ>" } } } }
  ```
- Ритм должен быть запущен (`npm run dev` или `npm start`). Облачные клиенты (claude.ai, телефон) — после деплоя с HTTPS и OAuth.
