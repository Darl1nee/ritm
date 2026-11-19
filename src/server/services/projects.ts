import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/factory";
import {
  projects,
  project_sections,
  tasks,
  notes,
  events,
  focus_sessions,
  type ProjectRow,
  type SectionRow,
} from "../db/schema";
import type { ProjectCreate, ProjectFilters, ProjectType, ProjectUpdate } from "@/shared/schemas";
import { NotFoundError, clean, matches, newId, nowIso } from "./common";
import { listTasks, type Task } from "./tasks";

export const SECTION_TEMPLATES: Record<ProjectType, string[]> = {
  project: ["Бэклог", "В работе", "Готово"],
  trip: ["Маршрут", "Брони", "Сборы"],
  content: ["Идеи", "Сценарий", "Съёмка", "Монтаж", "Публикация"],
  learning: ["Модуль 1", "Модуль 2", "Модуль 3"],
};

export interface Progress {
  done: number;
  total: number;
  /** 0–100, целое. */
  percent: number;
}
export type Project = ProjectRow & { progress: Progress };
export type ProjectDetail = Project & { sections: SectionRow[]; tasks: Task[] };

export function calcProgress(done: number, total: number): Progress {
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** Прогресс проектов по задачам верхнего уровня: id → Progress. */
async function progressMap(db: Db, projectIds: string[]): Promise<Map<string, Progress>> {
  const out = new Map<string, Progress>();
  if (projectIds.length === 0) return out;
  const agg = new Map<string, { done: number; total: number }>();
  const rows = await db
    .select({ project_id: tasks.project_id, done: tasks.done, parent_id: tasks.parent_id })
    .from(tasks)
    .where(inArray(tasks.project_id, projectIds))
    .all();
  for (const r of rows) {
    if (r.parent_id !== null) continue;
    const a = agg.get(r.project_id!) ?? { done: 0, total: 0 };
    a.total += 1;
    if (r.done) a.done += 1;
    agg.set(r.project_id!, a);
  }
  for (const id of projectIds) {
    const a = agg.get(id) ?? { done: 0, total: 0 };
    out.set(id, calcProgress(a.done, a.total));
  }
  return out;
}

export async function listProjects(db: Db, filters: ProjectFilters = {}): Promise<Project[]> {
  const where = [];
  if (filters.type) where.push(eq(projects.type, filters.type));
  if (filters.status) where.push(eq(projects.status, filters.status));
  let rows = await db
    .select()
    .from(projects)
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(projects.created_at))
    .all();
  if (filters.q) rows = rows.filter((p) => matches(filters.q!, p.title, p.description));
  const prog = await progressMap(db, rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, progress: prog.get(r.id) ?? calcProgress(0, 0) }));
}

async function getRow(db: Db, id: string): Promise<ProjectRow> {
  const row = await db.select().from(projects).where(eq(projects.id, id)).get();
  if (!row) throw new NotFoundError("Проект");
  return row;
}

export async function getProject(db: Db, id: string, now: Date = new Date()): Promise<ProjectDetail> {
  const row = await getRow(db, id);
  const sections = await db
    .select()
    .from(project_sections)
    .where(eq(project_sections.project_id, id))
    .orderBy(asc(project_sections.sort), asc(project_sections.created_at))
    .all();
  const projectTasks = await listTasks(db, { project_id: id }, now);
  const top = projectTasks.filter((t) => t.parent_id === null);
  const progress = calcProgress(top.filter((t) => t.done).length, top.length);
  return { ...row, progress, sections, tasks: projectTasks };
}

export async function createProject(db: Db, input: ProjectCreate, now: Date = new Date()): Promise<ProjectDetail> {
  const ts = nowIso(now);
  const id = newId();
  const type = input.type ?? "project";
  await db.transaction(async (tx) => {
    await tx.insert(projects)
      .values({
        id,
        title: input.title,
        type,
        status: input.status ?? "active",
        description: input.description ?? "",
        color: input.color ?? "#2e5eff",
        emoji: input.emoji ?? null,
        start_date: input.start_date ?? null,
        due_date: input.due_date ?? null,
        created_at: ts,
        updated_at: ts,
      })
      .run();
    for (let i = 0; i < SECTION_TEMPLATES[type].length; i++) {
      const title = SECTION_TEMPLATES[type][i];
      await tx.insert(project_sections)
        .values({ id: newId(), project_id: id, title, sort: i, created_at: ts, updated_at: ts })
        .run();
    }
  });
  return await getProject(db, id, now);
}

export async function updateProject(db: Db, id: string, patch: ProjectUpdate, now: Date = new Date()): Promise<ProjectDetail> {
  await getRow(db, id);
  await db.update(projects).set({ ...clean(patch), updated_at: nowIso(now) }).where(eq(projects.id, id)).run();
  return await getProject(db, id, now);
}

/** Удаляет проект, его секции и задачи (с подзадачами); заметки и события отвязываются. */
export async function deleteProject(db: Db, id: string): Promise<{ id: string }> {
  await getRow(db, id);
  await db.transaction(async (tx) => {
    const idRows = await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.project_id, id)).all();
    const ids = idRows.map((r) => r.id);
    if (ids.length) {
      const subRows = await tx.select({ id: tasks.id }).from(tasks).where(inArray(tasks.parent_id, ids)).all();
      const subIds = subRows.map((r) => r.id);
      const all = [...new Set([...ids, ...subIds])];
      await tx.update(focus_sessions).set({ task_id: null }).where(inArray(focus_sessions.task_id, all)).run();
      await tx.delete(tasks).where(inArray(tasks.id, all)).run();
    }
    await tx.delete(project_sections).where(eq(project_sections.project_id, id)).run();
    await tx.update(notes).set({ project_id: null }).where(eq(notes.project_id, id)).run();
    await tx.update(events).set({ project_id: null }).where(eq(events.project_id, id)).run();
    await tx.delete(projects).where(eq(projects.id, id)).run();
  });
  return { id };
}
