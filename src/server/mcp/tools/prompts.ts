import { z } from "zod";
import { hasAllScopes } from "../scopes";
import type { ToolCtx } from "./common";

const text = (t: string) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text: t } }] });

export function registerPrompts(ctx: ToolCtx) {
  ctx.server.registerPrompt(
    "plan_week",
    { title: "Спланировать неделю", description: "Спланируй мою неделю: задачи, события и свободное время." },
    () =>
      text(
        [
          "Спланируй мою неделю в Ритме.",
          "1. Вызови get_context, чтобы узнать сегодняшнюю дату и границы недели.",
          "2. Посмотри задачи недели (list_tasks с view=week и view=today), просроченные задачи, события недели (list_events) и свободное время (find_free_time), если эти инструменты доступны.",
          "3. Предложи конкретный план по дням: что и когда делать, с учётом приоритетов, сроков и свободных окон. Не перегружай дни.",
          "4. Покажи план мне и спроси подтверждение. Пока я не согласился, ничего не создавай и не меняй.",
          "5. После подтверждения внеси изменения (перенеси сроки, создай события) и коротко перечисли, что сделано.",
        ].join("\n"),
      ),
  );

  if (hasAllScopes(ctx.token.scopes, ["projects:write", "tasks:write"])) {
    ctx.server.registerPrompt(
      "break_down_project",
      {
        title: "Разбить проект на задачи",
        description: "Разбей проект на задачи по колонкам и создай их после подтверждения.",
        argsSchema: { project: z.string().describe("Название проекта или его id") },
      },
      ({ project }) =>
        text(
          [
            `Разбей проект «${project}» на задачи.`,
            "1. Найди проект (list_projects или search); если такого нет — предложи создать через create_project и спроси меня. Посмотри его колонки через get_project.",
            "2. Предложи структуру: колонки и задачи в них (с подзадачами, сроками и приоритетами, где это уместно). Не плоди дубли — учти уже существующие задачи.",
            "3. Покажи план и спроси подтверждение.",
            "4. После согласия создай всё одним вызовом plan_project и перечисли, что создано.",
          ].join("\n"),
        ),
    );
  }
}
