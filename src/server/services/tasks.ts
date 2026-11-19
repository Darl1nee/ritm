import { and, asc, eq, gte, inArray, lte, max } from "drizzle-orm";
import type { Db } from "../db/factory";
import { tasks, focus_sessions, type TaskRow } from "../db/schema";
import { bucketOf, isOverdue } from "@/shared/dates";
import type { TaskCreate, TaskFilters, TaskReorder, TaskUpdate } from "@/shared/schemas";
import { NotFoundError, clean, newId, nowIso } from "./common";

export type Task = TaskRow & {
  /** Просрочена (невыполненная, due_date < сегодня). */
  overdue: boolean;
  /** Бакет по правилам SPEC (null для выполненных). */
  view: "today" | "week" | "later" | "inbox" | null;
  subtasks_total: number;
  subtasks_done: number;
};
export type TaskWithSubtasks = Task & { subtasks: Task[] };

async function decorate(db: Db, rows: TaskRow[], now: Date): Promise<Task[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const subs = await db.select().from(tasks).where(inArray(tasks.parent_id, ids)).all();
  const counts = new Map<string, { total: number; done: number }>();
  for (const s of subs) {
    const c = counts.get(s.parent_id!) ?? { total: 0, done: 0 };
    c.total += 1;
    if (s.done) c.done += 1;
    counts.set(s.parent_id!, c);
  }
  return rows.map((r) => ({
    ...r,
    overdue: isOverdue(r, now),
    view: bucketOf(r, now),
    subtasks_total: counts.get(r.id)?.total ?? 0,
    subtasks_done: counts.get(r.id)?.done ?? 0,
  }));
}

export async function listTasks(db: Db, filters: TaskFilters = {}, now: Date = new Date()): Promise<Task[]> {
  const where = [];
  if (filters.project_id) where.push(eq(tasks.project_id, filters.project_id));
  if (filters.category_id) where.push(eq(tasks.category_id, filters.category_id));
  if (filters.goal_id) where.push(eq(tasks.goal_id, filters.goal_id));
  if (filters.done !== undefined) where.push(eq(tasks.done, filters.done));
  if (filters.from) where.push(gte(tasks.due_date, filters.from));
  if (filters.to) where.push(lte(tasks.due_date, filters.to));

  let rows = await db
    .select()
    .from(tasks)
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(tasks.sort), asc(tasks.created_at))
    .all();

  const view = filters.view;
  if (view && view !== "all") {
    // Представления — только верхний уровень; без явного done — только невыполненные.
    rows = rows.filter((t) => t.parent_id === null);
    if (filters.done === undefined) rows = rows.filter((t) => !t.done);
    rows = rows.filter((t) => bucketOf({ ...t, done: false }, now) === view);
  }
  return await decorate(db, rows, now);
}

async function getRow(db: Db, id: string): Promise<TaskRow> {
  const row = await db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!row) throw new NotFoundError("Задача");
  return row;
}

export async function getTask(db: Db, id: string, now: Date = new Date()): Promise<TaskWithSubtasks> {
  const row = await getRow(db, id);
  const subs = await db.select().from(tasks).where(eq(tasks.parent_id, id)).orderBy(asc(tasks.sort), asc(tasks.created_at)).all();
  const [task] = await decorate(db, [row], now);
  const subtasks = await decorate(db, subs, now);
  return { ...task, subtasks };
}

export async function createTask(db: Db, input: TaskCreate, now: Date = new Date()): Promise<TaskWithSubtasks> {
  const ts = nowIso(now);
  const topRow = await db.select({ m: max(tasks.sort) }).from(tasks).get();
  const top = topRow?.m ?? -1;
  const done = input.done ?? false;
  const id = newId();
  await db.insert(tasks)
    .values({
      id,
      title: input.title,
      notes: input.notes ?? "",
      done,
      completed_at: done ? ts : null,
      bucket: input.bucket ?? "inbox",
      due_date: input.due_date ?? null,
      due_time: input.due_time ?? null,
      duration_min: input.duration_min ?? null,
      priority: input.priority ?? 0,
      category_id: input.category_id ?? null,
      project_id: input.project_id ?? null,
      section_id: input.section_id ?? null,
      goal_id: input.goal_id ?? null,
      parent_id: input.parent_id ?? null,
      sort: input.sort ?? top + 1,
      created_at: ts,
      updated_at: ts,
    })
    .run();
  return await getTask(db, id, now);
}

export async function updateTask(db: Db, id: string, patch: TaskUpdate, now: Date = new Date()): Promise<TaskWithSubtasks> {
  const current = await getRow(db, id);
  const ts = nowIso(now);
  const set: Partial<TaskRow> = { ...clean(patch), updated_at: ts };
  if (patch.done !== undefined && patch.done !== current.done) {
    set.completed_at = patch.done ? ts : null;
  }
  await db.update(tasks).set(set).where(eq(tasks.id, id)).run();
  return await getTask(db, id, now);
}

/** Переключает done; проставляет/снимает completed_at. */
export async function toggleTask(db: Db, id: string, now: Date = new Date()): Promise<TaskWithSubtasks> {
  const current = await getRow(db, id);
  return await updateTask(db, id, { done: !current.done }, now);
}

/** Удаляет задачу вместе с подзадачами; фокус-сессии теряют привязку. */
export async function deleteTask(db: Db, id: string): Promise<{ id: string }> {
  await getRow(db, id);
  await db.transaction(async (tx) => {
    const subRows = await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.parent_id, id)).all();
    const subIds = subRows.map((r) => r.id);
    const all = [id, ...subIds];
    await tx.update(focus_sessions).set({ task_id: null }).where(inArray(focus_sessions.task_id, all)).run();
    await tx.delete(tasks).where(inArray(tasks.id, all)).run();
  });
  return { id };
}

/** Массовое изменение порядка / бакета / секции (drag-and-drop). */
export async function reorderTasks(db: Db, items: TaskReorder, now: Date = new Date()): Promise<{ updated: number }> {
  const ts = nowIso(now);
  await db.transaction(async (tx) => {
    for (const it of items) {
      const set: Partial<TaskRow> = { sort: it.sort, updated_at: ts };
      if (it.bucket !== undefined) set.bucket = it.bucket;
      if (it.section_id !== undefined) set.section_id = it.section_id;
      const res = await tx.update(tasks).set(set).where(eq(tasks.id, it.id)).run();
      const changes = res.rowsAffected ?? (res as unknown as { changes?: number }).changes ?? 0;
      if (changes === 0) throw new NotFoundError(`Задача ${it.id}`);
    }
  });
  return { updated: items.length };
}
