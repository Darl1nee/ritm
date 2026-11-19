import { asc, eq, max } from "drizzle-orm";
import type { Db } from "../db/factory";
import { categories, tasks, goals, type CategoryRow } from "../db/schema";
import type { CategoryCreate, CategoryUpdate } from "@/shared/schemas";
import { NotFoundError, clean, newId, nowIso } from "./common";

export type Category = CategoryRow;

export async function listCategories(db: Db): Promise<Category[]> {
  return await db.select().from(categories).orderBy(asc(categories.sort), asc(categories.created_at)).all();
}

export async function getCategory(db: Db, id: string): Promise<Category> {
  const row = await db.select().from(categories).where(eq(categories.id, id)).get();
  if (!row) throw new NotFoundError("Категория");
  return row;
}

export async function createCategory(db: Db, input: CategoryCreate): Promise<Category> {
  const ts = nowIso();
  const topRow = await db.select({ m: max(categories.sort) }).from(categories).get();
  const top = topRow?.m ?? -1;
  const row = {
    id: newId(),
    name: input.name,
    color: input.color ?? "#2e5eff",
    sort: input.sort ?? top + 1,
    created_at: ts,
    updated_at: ts,
  };
  await db.insert(categories).values(row).run();
  return row;
}

export async function updateCategory(db: Db, id: string, patch: CategoryUpdate): Promise<Category> {
  await getCategory(db, id);
  await db.update(categories).set({ ...clean(patch), updated_at: nowIso() }).where(eq(categories.id, id)).run();
  return await getCategory(db, id);
}

/** Удаляет категорию; у задач и целей category_id обнуляется. */
export async function deleteCategory(db: Db, id: string): Promise<{ id: string }> {
  await getCategory(db, id);
  await db.transaction(async (tx) => {
    await tx.update(tasks).set({ category_id: null }).where(eq(tasks.category_id, id)).run();
    await tx.update(goals).set({ category_id: null }).where(eq(goals.category_id, id)).run();
    await tx.delete(categories).where(eq(categories.id, id)).run();
  });
  return { id };
}
