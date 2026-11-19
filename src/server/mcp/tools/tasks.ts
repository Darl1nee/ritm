import { z } from "zod";
import { BUCKETS, TASK_VIEWS, dateStr, taskCreateSchema, taskUpdateSchema, timeStr } from "@/shared/schemas";
import type { Db } from "@/server/db/factory";
import { projects } from "@/server/db/schema";
import { listCategories } from "@/server/services/categories";
import { getTask, listTasks, createTask, updateTask, deleteTask, type Task, type TaskWithSubtasks } from "@/server/services/tasks";
import { getOverview } from "@/server/services/overview";
import { markAgent, snapshotEntity } from "@/server/services/activity";
import { tasks as tasksTable } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { hasScope } from "../scopes";
import { checkRefs, compact, defineTool, limitOf, localIso, log, must, q, ruShortDate, write, type ToolCtx } from "./common";

export interface Lookups {
  cats: Map<string, { id: string; name: string }>;
  projs: Map<string, { id: string; title: string }>;
}

export async function lookups(db: Db): Promise<Lookups> {
  const catsList = await listCategories(db);
  const cats = new Map(catsList.map((c) => [c.id, { id: c.id, name: c.name }]));
  const projsList = await db.select({ id: projects.id, title: projects.title }).from(projects).all();
  const projs = new Map(projsList.map((p) => [p.id, p]));
  return { cats, projs };
}

export function compactTask(t: Task, lk: Lookups) {
  return compact({
    id: t.id,
    title: t.title,
    done: t.done,
    bucket: t.bucket,
    view: t.view,
    overdue: t.overdue,
    due_date: t.due_date,
    due_time: t.due_time,
    duration_min: t.duration_min,
    priority: t.priority || null,
    category: t.category_id ? (lk.cats.get(t.category_id) ?? { id: t.category_id }) : null,
    project: t.project_id ? (lk.projs.get(t.project_id) ?? { id: t.project_id }) : null,
    section_id: t.section_id,
    goal_id: t.goal_id,
    parent_id: t.parent_id,
    subtasks_total: t.subtasks_total || null,
    subtasks_done: t.subtasks_total ? t.subtasks_done : null,
    notes: t.notes,
  });
}

export function compactTaskFull(t: TaskWithSubtasks, lk: Lookups) {
  const base = compactTask(t, lk);
  return t.subtasks.length ? { ...base, subtasks: t.subtasks.map((s) => compactTask(s, lk)) } : base;
}

async function taskRow(db: Db, id: string) {
  return must(await snapshotEntity(db, "task", id), "Задача");
}

function updateSummary(before: Record<string, unknown>, after: Record<string, unknown>): string {
  const title = q(String(after.title));
  if (before.done !== after.done) return after.done ? `Выполнена задача ${title}` : `Задача ${title} снова открыта`;
  if (before.due_date !== after.due_date) {
    return after.due_date ? `Задача ${title} перенесена на ${ruShortDate(String(after.due_date))}` : `У задачи ${title} снята дата`;
  }
  return `Изменена задача ${title}`;
}

const fields = {
  notes: z.string().describe("Заметки к задаче (текст)"),
  bucket: z.enum(BUCKETS).describe("Корзина: inbox (входящие), today, week, later. Просрочка и due_date определяют попадание в «Сегодня»/«На неделе» сами"),
  due_date: dateStr.describe("Срок, дата YYYY-MM-DD"),
  due_time: timeStr.describe("Время, HH:MM (локальное)"),
  duration_min: z.number().int().positive().describe("Длительность в минутах"),
  priority: z.number().int().min(0).max(3).describe("Приоритет 0–3 (3 — самый высокий)"),
  category_id: z.string().describe("id категории (см. list_categories)"),
  project_id: z.string().describe("id проекта"),
  section_id: z.string().describe("id колонки проекта"),
  goal_id: z.string().describe("id цели"),
  parent_id: z.string().describe("id родительской задачи (для подзадачи)"),
};

const nullable = <T extends z.ZodType>(s: T, hint: string) => s.nullable().optional().describe(`${hint}. null — очистить`);

export function registerTaskTools(ctx: ToolCtx) {
  const { db } = ctx;

  defineTool(ctx, {
    name: "get_overview",
    title: "Обзор дня",
    description:
      "Сводка: задачи на сегодня (выполнено/всего/просрочено), нагрузка по дням недели; события сегодня и активные проекты — если у ключа есть права на календарь и проекты. Удобна для утреннего обзора.",
    scopes: ["tasks:read"],
    kind: "read",
    run: async () => {
      const now = ctx.now();
      const ov = await getOverview(db, now);
      const lk = await lookups(db);
      const cal = hasScope(ctx.token.scopes, "calendar:read");
      return {
        date: ov.date,
        user_name: ov.user_name,
        tasks_today: {
          done: ov.tasks_today.done,
          total: ov.tasks_today.total,
          overdue: ov.tasks_today.overdue,
          items: ov.tasks_today.items.map((t) => compactTask(t, lk)),
        },
        week: ov.week.map((d) => ({
          date: d.date,
          tasks_done: d.tasks_done,
          tasks_open: d.tasks_open,
          ...(cal ? { events: d.events, events_min: d.events_min } : {}),
        })),
        ...(cal
          ? {
              events_today: ov.events_today.map((e) =>
                compact({ id: e.id, title: e.title, type: e.type, start_at: localIso(e.start_at), end_at: localIso(e.end_at), all_day: e.all_day }),
              ),
            }
          : {}),
        ...(hasScope(ctx.token.scopes, "projects:read")
          ? { projects: ov.projects.map((p) => compact({ id: p.id, title: p.title, type: p.type, progress: p.progress, due_date: p.due_date })) }
          : {}),
      };
    },
  });

  defineTool(ctx, {
    name: "list_tasks",
    title: "Список задач",
    description:
      "Список задач с фильтрами. view=today/week/later/inbox показывает невыполненные задачи верхнего уровня по правилам приложения; view=all или без view — все задачи, включая подзадачи.",
    scopes: ["tasks:read"],
    kind: "read",
    input: {
      view: z.enum(TASK_VIEWS).optional().describe("Представление: today (включая просроченные), week, later, inbox, all"),
      project_id: z.string().optional().describe("Только задачи этого проекта"),
      category_id: z.string().optional().describe("Только эта категория"),
      goal_id: z.string().optional().describe("Только задачи этой цели"),
      done: z.boolean().optional().describe("true — только выполненные, false — только невыполненные"),
      from: dateStr.optional().describe("Срок не раньше, YYYY-MM-DD"),
      to: dateStr.optional().describe("Срок не позже, YYYY-MM-DD"),
      limit: z.number().int().min(1).max(200).optional().describe("Сколько вернуть (по умолчанию 50, максимум 200)"),
    },
    run: async ({ limit, ...filters }) => {
      const all = await listTasks(db, filters, ctx.now());
      const lim = limitOf(limit);
      const lk = await lookups(db);
      return { total: all.length, returned: Math.min(all.length, lim), tasks: all.slice(0, lim).map((t) => compactTask(t, lk)) };
    },
  });

  defineTool(ctx, {
    name: "get_task",
    title: "Задача",
    description: "Одна задача со всеми полями и подзадачами.",
    scopes: ["tasks:read"],
    kind: "read",
    input: { id: z.string().describe("id задачи") },
    run: async ({ id }) => compactTaskFull(await getTask(db, id, ctx.now()), await lookups(db)),
  });

  defineTool(ctx, {
    name: "list_categories",
    title: "Категории",
    description: "Список категорий задач (id, название, цвет). Нужен, чтобы указать category_id.",
    scopes: ["tasks:read"],
    kind: "read",
    run: async () => (await listCategories(db)).map((c) => ({ id: c.id, name: c.name, color: c.color })),
  });

  defineTool(ctx, {
    name: "create_task",
    title: "Создать задачу",
    description:
      "Создаёт задачу, при необходимости сразу с подзадачами. Перед созданием поищите похожую через search/list_tasks, чтобы не плодить дубли.",
    scopes: ["tasks:write"],
    kind: "write",
    input: {
      title: z.string().describe("Название задачи"),
      notes: fields.notes.optional(),
      bucket: fields.bucket.optional(),
      due_date: nullable(fields.due_date, "Срок, дата YYYY-MM-DD"),
      due_time: nullable(fields.due_time, "Время HH:MM"),
      duration_min: nullable(fields.duration_min, "Длительность в минутах"),
      priority: fields.priority.optional(),
      category_id: nullable(fields.category_id, "id категории"),
      project_id: nullable(fields.project_id, "id проекта"),
      section_id: nullable(fields.section_id, "id колонки проекта"),
      goal_id: nullable(fields.goal_id, "id цели"),
      parent_id: nullable(fields.parent_id, "id родительской задачи"),
      subtasks: z.array(z.string().min(1)).max(50).optional().describe("Названия подзадач — будут созданы сразу"),
    },
    run: async ({ subtasks, ...rest }) => {
      const input = taskCreateSchema.parse(rest);
      const now = ctx.now();
      return await write(ctx, async (tx) => {
        await checkRefs(tx, input);
        const t = await createTask(tx, input, now);
        await markAgent(tx, "task", t.id);
        for (const title of subtasks ?? []) {
          const s = await createTask(
            tx,
            { title, parent_id: t.id, project_id: t.project_id, category_id: t.category_id, bucket: t.bucket },
            now,
          );
          await markAgent(tx, "task", s.id);
        }
        await log(tx, ctx, "create_task", "task", t.id, "create", `Создана задача ${q(t.title)}`, undefined, await taskRow(tx, t.id));
        return compactTaskFull(await getTask(tx, t.id, now), await lookups(tx));
      });
    },
  });

  defineTool(ctx, {
    name: "update_task",
    title: "Изменить задачу",
    description: "Меняет поля задачи. Передавайте только то, что нужно изменить; null очищает дату, время, проект и т.п.",
    scopes: ["tasks:write"],
    kind: "write",
    input: {
      id: z.string().describe("id задачи"),
      title: z.string().optional().describe("Новое название"),
      notes: fields.notes.optional(),
      done: z.boolean().optional().describe("Выполнена ли задача"),
      bucket: fields.bucket.optional(),
      due_date: nullable(fields.due_date, "Срок, дата YYYY-MM-DD"),
      due_time: nullable(fields.due_time, "Время HH:MM"),
      duration_min: nullable(fields.duration_min, "Длительность в минутах"),
      priority: fields.priority.optional(),
      category_id: nullable(fields.category_id, "id категории"),
      project_id: nullable(fields.project_id, "id проекта"),
      section_id: nullable(fields.section_id, "id колонки проекта"),
      goal_id: nullable(fields.goal_id, "id цели"),
      parent_id: nullable(fields.parent_id, "id родительской задачи"),
    },
    run: async ({ id, ...raw }) => {
      const patch = taskUpdateSchema.parse(raw);
      if (!Object.values(patch).some((v) => v !== undefined)) throw new RangeError("Не указано ни одного поля для изменения");
      const now = ctx.now();
      return await write(ctx, async (tx) => {
        const before = await taskRow(tx, id);
        await checkRefs(tx, patch);
        await updateTask(tx, id, patch, now);
        const after = await taskRow(tx, id);
        await log(tx, ctx, "update_task", "task", id, "update", updateSummary(before, after), before, after);
        return compactTaskFull(await getTask(tx, id, now), await lookups(tx));
      });
    },
  });

  defineTool(ctx, {
    name: "complete_task",
    title: "Отметить задачу",
    description: "Отмечает задачу выполненной (или снимает отметку при done=false).",
    scopes: ["tasks:write"],
    kind: "write",
    input: {
      id: z.string().describe("id задачи"),
      done: z.boolean().optional().describe("true (по умолчанию) — выполнена, false — вернуть в работу"),
    },
    run: async ({ id, done }) => {
      const now = ctx.now();
      return await write(ctx, async (tx) => {
        const before = await taskRow(tx, id);
        await updateTask(tx, id, { done: done ?? true }, now);
        const after = await taskRow(tx, id);
        await log(tx, ctx, "complete_task", "task", id, "update", updateSummary(before, after), before, after);
        return compactTaskFull(await getTask(tx, id, now), await lookups(tx));
      });
    },
  });

  defineTool(ctx, {
    name: "delete_task",
    title: "Удалить задачу",
    description: "Удаляет задачу вместе с подзадачами. Действие можно отменить в журнале, но сначала подтвердите удаление у пользователя.",
    scopes: ["tasks:write"],
    kind: "destructive",
    input: { id: z.string().describe("id задачи") },
    run: async ({ id }) =>
      await write(ctx, async (tx) => {
        const task = await taskRow(tx, id);
        const subtasks = await tx.select().from(tasksTable).where(eq(tasksTable.parent_id, id)).all();
        await deleteTask(tx, id);
        await log(tx, ctx, "delete_task", "task", id, "delete", `Удалена задача ${q(String(task.title))}`, { task, subtasks });
        return { deleted: { id, title: task.title, subtasks: subtasks.length } };
      }),
  });
}
