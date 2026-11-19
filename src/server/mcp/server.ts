import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Db } from "@/server/db/factory";
import type { McpToken } from "@/server/services/mcp-tokens";
import type { ToolCtx } from "./tools/common";
import { registerCalendarTools } from "./tools/calendar";
import { registerContextTools } from "./tools/context";
import { registerGoalTools } from "./tools/goals";
import { registerNoteTools } from "./tools/notes";
import { registerProjectTools } from "./tools/projects";
import { registerPrompts } from "./tools/prompts";
import { registerSearchTools } from "./tools/search";
import { registerTaskTools } from "./tools/tasks";

export const INSTRUCTIONS = `Ритм. — личный планировщик пользователя: задачи, проекты, календарь, заметки и цели.

Начинайте с get_context: там текущая дата и время, день недели, часовой пояс и ваши права.

Задачи делятся на корзины: inbox (входящие: без срока и без проекта), today, week, later. Попадание определяется так: «Сегодня» — bucket=today или срок сегодня/раньше (просроченные тоже здесь); «На неделе» — bucket=week или срок в пределах текущей недели пн–вс; «Входящие» — bucket=inbox без срока и проекта; всё остальное — «Потом».

Форматы: даты YYYY-MM-DD, время HH:MM, моменты событий — ISO 8601 с часовым поясом (например 2026-11-20T15:00:00+03:00).

Правила работы:
- Перед созданием чего-либо сначала поищите (search, list_tasks), чтобы не плодить дубли.
- Для планирования времени используйте find_free_time, а не угадывайте.
- Массовые изменения (больше 5 сущностей) и любые удаления — сначала опишите план пользователю и получите согласие.
- Все ваши действия видны пользователю в журнале (Настройки → Интеграции) и могут быть им отменены.
- Если инструмента нет в списке, у ключа нет на него прав.`;

export interface CreateRitmMcpServerOptions {
  db: Db;
  token: McpToken;
  /** Источник текущего времени (для тестов). */
  now?: Date | (() => Date);
}

/** Чистая фабрика MCP-сервера: только инструменты, разрешённые правами ключа. Не зависит от HTTP. */
export function createRitmMcpServer({ db, token, now }: CreateRitmMcpServerOptions): McpServer {
  const server = new McpServer({ name: "ritm", version: "1.0.0" }, { instructions: INSTRUCTIONS });
  const clock = typeof now === "function" ? now : now ? () => now : () => new Date();
  const ctx: ToolCtx = { server, db, token, now: clock };

  registerContextTools(ctx);
  registerTaskTools(ctx);
  registerProjectTools(ctx);
  registerCalendarTools(ctx);
  registerNoteTools(ctx);
  registerGoalTools(ctx);
  registerSearchTools(ctx);
  registerPrompts(ctx);
  return server;
}
