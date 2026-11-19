import { format, formatISO } from "date-fns";
import { ru } from "date-fns/locale";
import { todayStr, weekRange } from "@/shared/dates";
import { getSettings } from "@/server/services/settings";
import { defineTool, type ToolCtx } from "./common";

export function registerContextTools(ctx: ToolCtx) {
  defineTool(ctx, {
    name: "get_context",
    title: "Текущий контекст",
    description:
      "Возвращает текущее время, локальную дату, день недели, часовой пояс, границы текущей недели, имя пользователя и выданные ключу права. Вызывайте первым в начале работы.",
    scopes: [],
    kind: "read",
    run: async () => {
      const now = ctx.now();
      const settings = await getSettings(ctx.db);
      return {
        now: formatISO(now),
        date: todayStr(now),
        weekday: format(now, "EEEE", { locale: ru }),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        week: weekRange(now),
        user_name: settings.user_name,
        key_name: ctx.token.name,
        scopes: ctx.token.scopes,
      };
    },
  });
}
