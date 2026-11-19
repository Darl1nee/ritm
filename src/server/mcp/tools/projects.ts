import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  PROJECT_STATUSES,
  PROJECT_TYPES,
  BUCKETS,
  dateStr,
  hexColor,
  projectCreateSchema,
  projectUpdateSchema,
  taskCreateSchema,
  timeStr,
} from "@/shared/schemas";
import type { Db } from "@/server/db/factory";
import { project_sections } from "@/server/db/schema";
import { createProject, getProject, listProjects, updateProject, type ProjectDetail } from "@/server/services/projects";
import { createSection, updateSection } from "@/server/services/sections";
import { createTask } from "@/server/services/tasks";
import { markAgent, snapshotEntity } from "@/server/services/activity";
import { NotFoundError } from "@/server/services/common";
import { hasScope } from "../scopes";
import { checkRefs, compact, defineTool, log, must, q, write, type ToolCtx } from "./common";
import { compactTask, lookups } from "./tasks";

function compactProject(p: { id: string; title: string; type: string; status: string; description: string; color: string; emoji: string | null; start_date: string | null; due_date: string | null; progress: unknown }) {
  return compact({
    id: p.id,
    title: p.title,
    type: p.type,
    status: p.status,
    description: p.description,
    emoji: p.emoji,
    color: p.color,
    start_date: p.start_date,
    due_date: p.due_date,
    progress: p.progress,
  });
}

async function projectResult(ctx: ToolCtx, db: Db, p: ProjectDetail) {
  const withTasks = hasScope(ctx.token.scopes, "tasks:read");
  const lk = withTasks ? await lookups(db) : null;
  return {
    ...compactProject(p),
    sections: p.sections.map((s) => ({ id: s.id, title: s.title })),
    ...(withTasks && lk
      ? { tasks: p.tasks.filter((t) => t.parent_id === null).slice(0, 200).map((t) => compactTask(t, lk)) }
      : {}),
  };
}

const planTaskShape = z.object({
  title: z.string().describe("Название задачи"),
  section: z.string().optional().describe("Название колонки (без учёта регистра). Если такой нет — будет создана"),
  section_id: z.string().optional().describe("id существующей колонки (вместо section)"),
  due_date: dateStr.optional().describe("Срок, YYYY-MM-DD"),
  due_time: timeStr.optional().describe("Время, HH:MM"),
  duration_min: z.number().int().positive().optional().describe("Длительность в минутах"),
  priority: z.number().int().min(0).max(3).optional().describe("Приоритет 0–3"),
  category_id: z.string().optional().describe("id категории"),
  bucket: z.enum(BUCKETS).optional().describe("Корзина: inbox, today, week, later"),
  notes: z.string().optional().describe("Заметки к задаче"),
  subtasks: z.array(z.string().min(1)).max(50).optional().describe("Названия подзадач"),
});

export function registerProjectTools(ctx: ToolCtx) {
  const { db } = ctx;

  defineTool(ctx, {
    name: "list_projects",
    title: "Список проектов",
    description: "Проекты с прогрессом. Можно фильтровать по типу, статусу и подстроке в названии/описании.",
    scopes: ["projects:read"],
    kind: "read",
    input: {
      type: z.enum(PROJECT_TYPES).optional().describe("Тип: project, trip, content, learning"),
      status: z.enum(PROJECT_STATUSES).optional().describe("Статус: active, paused, done, archived"),
      q: z.string().optional().describe("Подстрока в названии или описании"),
    },
    run: async (filters) => (await listProjects(db, filters)).map(compactProject),
  });

  defineTool(ctx, {
    name: "get_project",
    title: "Проект",
    description: "Проект с колонками (секциями) и прогрессом. Задачи проекта включены, только если у ключа есть право tasks:read.",
    scopes: ["projects:read"],
    kind: "read",
    input: { id: z.string().describe("id проекта") },
    run: async ({ id }) => await projectResult(ctx, db, await getProject(db, id, ctx.now())),
  });

  defineTool(ctx, {
    name: "create_project",
    title: "Создать проект",
    description: "Создаёт проект; колонки создаются по шаблону типа (например, у project: Бэклог, В работе, Готово).",
    scopes: ["projects:write"],
    kind: "write",
    input: {
      title: z.string().describe("Название проекта"),
      type: z.enum(PROJECT_TYPES).optional().describe("Тип: project (по умолчанию), trip, content, learning"),
      description: z.string().optional().describe("Описание"),
      emoji: z.string().optional().describe("Эмодзи проекта"),
      color: hexColor.optional().describe("Цвет #rrggbb"),
      start_date: dateStr.optional().describe("Дата начала, YYYY-MM-DD"),
      due_date: dateStr.optional().describe("Срок, YYYY-MM-DD"),
    },
    run: async (raw) => {
      const input = projectCreateSchema.parse(raw);
      const now = ctx.now();
      return await write(ctx, async (tx) => {
        const p = await createProject(tx, input, now);
        await markAgent(tx, "project", p.id);
        await log(tx, ctx, "create_project", "project", p.id, "create", `Создан проект ${q(p.title)}`, undefined, await snapshotEntity(tx, "project", p.id));
        return await projectResult(ctx, tx, await getProject(tx, p.id, now));
      });
    },
  });

  defineTool(ctx, {
    name: "update_project",
    title: "Изменить проект",
    description: "Меняет поля проекта, в том числе статус (active, paused, done, archived). Передавайте только изменяемое.",
    scopes: ["projects:write"],
    kind: "write",
    input: {
      id: z.string().describe("id проекта"),
      title: z.string().optional().describe("Новое название"),
      type: z.enum(PROJECT_TYPES).optional().describe("Тип проекта"),
      status: z.enum(PROJECT_STATUSES).optional().describe("Статус проекта"),
      description: z.string().optional().describe("Описание"),
      emoji: z.string().nullable().optional().describe("Эмодзи; null — убрать"),
      color: hexColor.optional().describe("Цвет #rrggbb"),
      start_date: dateStr.nullable().optional().describe("Дата начала; null — очистить"),
      due_date: dateStr.nullable().optional().describe("Срок; null — очистить"),
    },
    run: async ({ id, ...raw }) => {
      const patch = projectUpdateSchema.parse(raw);
      if (!Object.values(patch).some((v) => v !== undefined)) throw new RangeError("Не указано ни одного поля для изменения");
      const now = ctx.now();
      return await write(ctx, async (tx) => {
        const before = must(await snapshotEntity(tx, "project", id), "Проект");
        await updateProject(tx, id, patch, now);
        const after = await snapshotEntity(tx, "project", id);
        await log(tx, ctx, "update_project", "project", id, "update", `Изменён проект ${q(String(after?.title))}`, before, after);
        return await projectResult(ctx, tx, await getProject(tx, id, now));
      });
    },
  });

  defineTool(ctx, {
    name: "add_section",
    title: "Добавить колонку",
    description: "Добавляет колонку (секцию) в проект.",
    scopes: ["projects:write"],
    kind: "write",
    input: {
      project_id: z.string().describe("id проекта"),
      title: z.string().min(1).describe("Название колонки"),
    },
    run: async ({ project_id, title }) =>
      await write(ctx, async (tx) => {
        const proj = must(await snapshotEntity(tx, "project", project_id), "Проект");
        const s = await createSection(tx, project_id, { title: title.trim() });
        await log(tx, ctx, "add_section", "section", s.id, "create", `Добавлена колонка ${q(s.title)} в проекте ${q(String(proj.title))}`, undefined, await snapshotEntity(tx, "section", s.id));
        return { id: s.id, title: s.title, project_id };
      }),
  });

  defineTool(ctx, {
    name: "rename_section",
    title: "Переименовать колонку",
    description: "Меняет название колонки (секции) проекта.",
    scopes: ["projects:write"],
    kind: "write",
    input: {
      id: z.string().describe("id колонки"),
      title: z.string().min(1).describe("Новое название"),
    },
    run: async ({ id, title }) =>
      await write(ctx, async (tx) => {
        const before = must(await snapshotEntity(tx, "section", id), "Колонка");
        const s = await updateSection(tx, id, { title: title.trim() });
        await log(tx, ctx, "rename_section", "section", id, "update", `Колонка ${q(String(before.title))} переименована в ${q(s.title)}`, before, await snapshotEntity(tx, "section", id));
        return { id: s.id, title: s.title, project_id: s.project_id };
      }),
  });

  defineTool(ctx, {
    name: "plan_project",
    title: "Спланировать проект",
    description:
      "Создаёт пачку задач в проекте за одну операцию (1–100) с колонками и подзадачами. Несуществующие колонки создаются по названию. Если хоть одна задача некорректна, не создаётся ничего. Используйте после согласования плана с пользователем.",
    scopes: ["projects:write", "tasks:write"],
    kind: "write",
    input: {
      project_id: z.string().describe("id проекта"),
      tasks: z.array(planTaskShape).min(1).max(100).describe("Задачи плана"),
    },
    run: async ({ project_id, tasks: plan }) => {
      const now = ctx.now();
      return await write(ctx, async (tx) => {
        const project = must(await snapshotEntity(tx, "project", project_id), "Проект");
        const ptitle = q(String(project.title));
        const sections = await tx.select().from(project_sections).where(eq(project_sections.project_id, project_id)).all();
        const byName = new Map(sections.map((s) => [s.title.trim().toLowerCase(), s]));
        const createdSections: { id: string; title: string }[] = [];
        const createdTasks: { id: string; title: string; section_id: string | null; subtasks: number }[] = [];

        for (const item of plan) {
          let section_id: string | null = null;
          if (item.section_id) {
            const s = await tx
              .select({ id: project_sections.id })
              .from(project_sections)
              .where(and(eq(project_sections.id, item.section_id), eq(project_sections.project_id, project_id)))
              .get();
            if (!s) throw new NotFoundError(`Колонка ${item.section_id} в этом проекте`);
            section_id = s.id;
          } else if (item.section?.trim()) {
            const key = item.section.trim().toLowerCase();
            let s = byName.get(key);
            if (!s) {
              s = await createSection(tx, project_id, { title: item.section.trim() });
              byName.set(key, s);
              createdSections.push({ id: s.id, title: s.title });
              await log(tx, ctx, "plan_project", "section", s.id, "create", `План проекта ${ptitle}: колонка ${q(s.title)}`, undefined, await snapshotEntity(tx, "section", s.id));
            }
            section_id = s.id;
          }

          const { subtasks, section: _s, section_id: _sid, ...rest } = item;
          void _s;
          void _sid;
          const input = taskCreateSchema.parse({ ...rest, project_id, section_id });
          await checkRefs(tx, { category_id: input.category_id });
          const t = await createTask(tx, input, now);
          await markAgent(tx, "task", t.id);
          for (const title of subtasks ?? []) {
            const sub = await createTask(tx, { title, parent_id: t.id, project_id, section_id, category_id: input.category_id }, now);
            await markAgent(tx, "task", sub.id);
          }
          await log(tx, ctx, "plan_project", "task", t.id, "create", `План проекта ${ptitle}: задача ${q(t.title)}`, undefined, await snapshotEntity(tx, "task", t.id));
          createdTasks.push({ id: t.id, title: t.title, section_id, subtasks: subtasks?.length ?? 0 });
        }
        return {
          project: { id: project_id, title: project.title },
          summary: `План проекта ${ptitle}: ${tasksWord(createdTasks.length)}`,
          created_sections: createdSections,
          created_tasks: createdTasks,
        };
      });
    },
  });
}

/** «1 задача», «3 задачи», «12 задач». */
function tasksWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  const word = m10 === 1 && m100 !== 11 ? "задача" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "задачи" : "задач";
  return `${n} ${word}`;
}
