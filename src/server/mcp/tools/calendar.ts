import { z } from "zod";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { dateStr, eventCreateSchema, eventTypeSchema, eventUpdateSchema, isoDateTime, timeStr } from "@/shared/schemas";
import { createEvent, deleteEvent, getEvent, listEvents, updateEvent, type CalendarEvent } from "@/server/services/events";
import { listTasks } from "@/server/services/tasks";
import { markAgent, snapshotEntity } from "@/server/services/activity";
import { hasScope } from "../scopes";
import { checkRefs, compact, defineTool, localIso, log, must, q, write, type ToolCtx } from "./common";
import { busyOfEvent, datesBetween, freeWindowsForDay, localMs, type BusyInterval } from "./free-time";

const MAX_RANGE_DAYS = 62;

export function compactEvent(e: CalendarEvent) {
  return compact({
    id: e.id,
    title: e.title,
    type: e.type,
    start_at: localIso(e.start_at),
    end_at: localIso(e.end_at),
    all_day: e.all_day,
    location: e.location,
    notes: e.notes,
    project_id: e.project_id,
  });
}

function checkRange(from: string, to: string): void {
  const days = differenceInCalendarDays(parseISO(to), parseISO(from));
  if (days < 0) throw new RangeError("from позже to");
  if (days + 1 > MAX_RANGE_DAYS) throw new RangeError(`Диапазон не больше ${MAX_RANGE_DAYS} дней`);
}

const eventFields = {
  type: eventTypeSchema.describe("Тип: meeting, sport, personal, focus, other"),
  start_at: isoDateTime.describe("Начало, ISO 8601 с часовым поясом, например 2026-11-20T15:00:00+03:00"),
  end_at: isoDateTime.describe("Конец, ISO 8601 с часовым поясом"),
  all_day: z.boolean().describe("Событие на весь день"),
  location: z.string().describe("Место"),
  notes: z.string().describe("Заметки к событию"),
};

export function registerCalendarTools(ctx: ToolCtx) {
  const { db } = ctx;

  defineTool(ctx, {
    name: "list_events",
    title: "События календаря",
    description: "События, пересекающие диапазон дат (включительно, максимум 62 дня). Время возвращается в часовом поясе сервера.",
    scopes: ["calendar:read"],
    kind: "read",
    input: {
      from: dateStr.describe("Первая дата, YYYY-MM-DD"),
      to: dateStr.describe("Последняя дата, YYYY-MM-DD"),
    },
    run: async ({ from, to }) => {
      checkRange(from, to);
      return (await listEvents(db, { from, to })).map(compactEvent);
    },
  });

  defineTool(ctx, {
    name: "find_free_time",
    title: "Свободное время",
    description:
      "Находит свободные окна по дням в рабочих часах с учётом событий (и задач со временем, если у ключа есть tasks:read). Не предлагает время в прошлом. Используйте для планирования.",
    scopes: ["calendar:read"],
    kind: "read",
    input: {
      from: dateStr.describe("Первая дата, YYYY-MM-DD"),
      to: dateStr.describe("Последняя дата, YYYY-MM-DD"),
      min_duration_min: z.number().int().min(1).max(1440).optional().describe("Минимальная длина окна в минутах (по умолчанию 30)"),
      day_start: timeStr.optional().describe("Начало дня HH:MM (по умолчанию 09:00)"),
      day_end: timeStr.optional().describe("Конец дня HH:MM (по умолчанию 21:00)"),
    },
    run: async ({ from, to, min_duration_min, day_start, day_end }) => {
      checkRange(from, to);
      const dayStart = day_start ?? "09:00";
      const dayEnd = day_end ?? "21:00";
      if (localMs(from, dayEnd) <= localMs(from, dayStart)) throw new RangeError("day_end должен быть позже day_start");
      const now = ctx.now();

      const eventsList = await listEvents(db, { from, to });
      const busy: BusyInterval[] = eventsList.map(busyOfEvent);
      if (hasScope(ctx.token.scopes, "tasks:read")) {
        const tasksList = await listTasks(db, { from, to, done: false }, now);
        for (const t of tasksList) {
          if (!t.due_date || !t.due_time) continue;
          const start = localMs(t.due_date, t.due_time);
          busy.push({ start, end: start + (t.duration_min ?? 30) * 60_000 });
        }
      }
      const minMinutes = min_duration_min ?? 30;
      return {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        days: datesBetween(from, to).map((date) => ({
          date,
          free: freeWindowsForDay({ date, dayStart, dayEnd, minMinutes, busy, now }),
        })),
      };
    },
  });

  defineTool(ctx, {
    name: "create_event",
    title: "Создать событие",
    description: "Создаёт событие в календаре. Время — ISO 8601 с часовым поясом. Перед созданием проверьте пересечения через list_events или find_free_time.",
    scopes: ["calendar:write"],
    kind: "write",
    input: {
      title: z.string().describe("Название события"),
      type: eventFields.type.optional(),
      start_at: eventFields.start_at,
      end_at: eventFields.end_at,
      all_day: eventFields.all_day.optional(),
      location: eventFields.location.optional(),
      notes: eventFields.notes.optional(),
      project_id: z.string().optional().describe("id проекта"),
    },
    run: async (raw) => {
      const input = eventCreateSchema.parse(raw);
      return await write(ctx, async (tx) => {
        await checkRefs(tx, input);
        const e = await createEvent(tx, input);
        await markAgent(tx, "event", e.id);
        await log(tx, ctx, "create_event", "event", e.id, "create", `Создано событие ${q(e.title)}`, undefined, await snapshotEntity(tx, "event", e.id));
        return compactEvent(await getEvent(tx, e.id));
      });
    },
  });

  defineTool(ctx, {
    name: "update_event",
    title: "Изменить событие",
    description: "Меняет поля события. Передавайте только изменяемое.",
    scopes: ["calendar:write"],
    kind: "write",
    input: {
      id: z.string().describe("id события"),
      title: z.string().optional().describe("Новое название"),
      type: eventFields.type.optional(),
      start_at: eventFields.start_at.optional(),
      end_at: eventFields.end_at.optional(),
      all_day: eventFields.all_day.optional(),
      location: eventFields.location.optional(),
      notes: eventFields.notes.optional(),
      project_id: z.string().nullable().optional().describe("id проекта; null — отвязать"),
    },
    run: async ({ id, ...raw }) => {
      const patch = eventUpdateSchema.parse(raw);
      if (!Object.values(patch).some((v) => v !== undefined)) throw new RangeError("Не указано ни одного поля для изменения");
      return await write(ctx, async (tx) => {
        const before = must(await snapshotEntity(tx, "event", id), "Событие");
        await checkRefs(tx, patch);
        const e = await updateEvent(tx, id, patch);
        const moved = patch.start_at !== undefined || patch.end_at !== undefined;
        await log(tx, ctx, "update_event", "event", id, "update", `${moved ? "Перенесено" : "Изменено"} событие ${q(e.title)}`, before, await snapshotEntity(tx, "event", id));
        return compactEvent(e);
      });
    },
  });

  defineTool(ctx, {
    name: "delete_event",
    title: "Удалить событие",
    description: "Удаляет событие из календаря. Подтвердите удаление у пользователя; действие можно отменить в журнале.",
    scopes: ["calendar:write"],
    kind: "destructive",
    input: { id: z.string().describe("id события") },
    run: async ({ id }) =>
      await write(ctx, async (tx) => {
        const before = must(await snapshotEntity(tx, "event", id), "Событие");
        await deleteEvent(tx, id);
        await log(tx, ctx, "delete_event", "event", id, "delete", `Удалено событие ${q(String(before.title))}`, before);
        return { deleted: { id, title: before.title } };
      }),
  });
}
