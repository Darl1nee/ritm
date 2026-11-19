import { asc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/factory";
import { goals, tasks, type GoalRow } from "../db/schema";
import type { GoalCreate, GoalUpdate } from "@/shared/schemas";
import { NotFoundError, clean, newId, nowIso } from "./common";
import { calcProgress, type Progress } from "./projects";

export type Goal = GoalRow & { progress: Progress };

async function withProgress(db: Db, rows: GoalRow[]): Promise<Goal[]> {
  if (rows.length === 0) return [];
  const linked = await db
    .select({ goal_id: tasks.goal_id, done: tasks.done, parent_id: tasks.parent_id })
    .from(tasks)
    .where(inArray(tasks.goal_id, rows.map((r) => r.id)))
    .all();
  const agg = new Map<string, { done: number; total: number }>();
  for (const t of linked) {
    if (t.parent_id !== null) continue;
    const a = agg.get(t.goal_id!) ?? { done: 0, total: 0 };
    a.total += 1;
    if (t.done) a.done += 1;
    agg.set(t.goal_id!, a);
  }
  return rows.map((r) => {
    const a = agg.get(r.id) ?? { done: 0, total: 0 };
    return { ...r, progress: calcProgress(a.done, a.total) };
  });
}

export async function listGoals(db: Db): Promise<Goal[]> {
  const all = await db.select().from(goals).orderBy(asc(goals.created_at)).all();
  return await withProgress(db, all);
}

async function getRow(db: Db, id: string): Promise<GoalRow> {
  const row = await db.select().from(goals).where(eq(goals.id, id)).get();
  if (!row) throw new NotFoundError("Цель");
  return row;
}

export async function getGoal(db: Db, id: string): Promise<Goal> {
  const row = await getRow(db, id);
  const withProg = await withProgress(db, [row]);
  return withProg[0];
}

export async function createGoal(db: Db, input: GoalCreate): Promise<Goal> {
  const ts = nowIso();
  const id = newId();
  await db.insert(goals)
    .values({
      id,
      title: input.title,
      description: input.description ?? "",
      target_date: input.target_date ?? null,
      category_id: input.category_id ?? null,
      status: input.status ?? "active",
      created_at: ts,
      updated_at: ts,
    })
    .run();
  return await getGoal(db, id);
}

export async function updateGoal(db: Db, id: string, patch: GoalUpdate): Promise<Goal> {
  await getRow(db, id);
  await db.update(goals).set({ ...clean(patch), updated_at: nowIso() }).where(eq(goals.id, id)).run();
  return await getGoal(db, id);
}

/** Удаляет цель; у привязанных задач goal_id обнуляется. */
export async function deleteGoal(db: Db, id: string): Promise<{ id: string }> {
  await getRow(db, id);
  await db.transaction(async (tx) => {
    await tx.update(tasks).set({ goal_id: null }).where(eq(tasks.goal_id, id)).run();
    await tx.delete(goals).where(eq(goals.id, id)).run();
  });
  return { id };
}
