import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-db";
import type { Db } from "../db/factory";
import { createCategory, deleteCategory } from "./categories";
import { NotFoundError } from "./common";
import { createTask, deleteTask, getTask, listTasks, reorderTasks, toggleTask, updateTask } from "./tasks";

// Среда, 18 ноября 2026
const NOW = new Date(2026, 10, 18, 12, 0, 0);
let db: Db;

beforeEach(async () => {
  db = await createTestDb();
});

describe("tasks service", () => {
  it("создаёт задачу с дефолтами", async () => {
    const t = await createTask(db, { title: "Купить хлеб" }, NOW);
    expect(t.id).toBeTruthy();
    expect(t.done).toBe(false);
    expect(t.bucket).toBe("inbox");
    expect(t.completed_at).toBeNull();
    expect(t.view).toBe("inbox");
    expect(t.subtasks).toEqual([]);
  });

  it("toggle проставляет и снимает completed_at", async () => {
    const t = await createTask(db, { title: "A" }, NOW);
    const on = await toggleTask(db, t.id, NOW);
    expect(on.done).toBe(true);
    expect(on.completed_at).toBe(NOW.toISOString());
    const off = await toggleTask(db, t.id, NOW);
    expect(off.done).toBe(false);
    expect(off.completed_at).toBeNull();
  });

  it("update через done тоже управляет completed_at, а частичный patch не затирает поля", async () => {
    const t = await createTask(db, { title: "A", priority: 2, bucket: "week" }, NOW);
    const u = await updateTask(db, t.id, { done: true }, NOW);
    expect(u.completed_at).not.toBeNull();
    expect(u.priority).toBe(2);
    expect(u.bucket).toBe("week");
  });

  it("view=today включает bucket=today и просроченные, исключает выполненные", async () => {
    await createTask(db, { title: "bucket today", bucket: "today" }, NOW);
    await createTask(db, { title: "overdue", bucket: "week", due_date: "2026-11-10" }, NOW);
    await createTask(db, { title: "week", bucket: "week" }, NOW);
    const done = await createTask(db, { title: "done", bucket: "today" }, NOW);
    await toggleTask(db, done.id, NOW);

    const today = await listTasks(db, { view: "today" }, NOW);
    expect(today.map((t) => t.title).sort()).toEqual(["bucket today", "overdue"]);
    expect(today.find((t) => t.title === "overdue")!.overdue).toBe(true);
    expect((await listTasks(db, { view: "week" }, NOW)).map((t) => t.title)).toEqual(["week"]);
    expect((await listTasks(db, { done: true }, NOW)).map((t) => t.title)).toEqual(["done"]);
  });

  it("view=inbox и view=later", async () => {
    await createTask(db, { title: "in", bucket: "inbox" }, NOW);
    await createTask(db, { title: "later", bucket: "later" }, NOW);
    expect((await listTasks(db, { view: "inbox" }, NOW)).map((t) => t.title)).toEqual(["in"]);
    expect((await listTasks(db, { view: "later" }, NOW)).map((t) => t.title)).toEqual(["later"]);
  });

  it("фильтр по диапазону дат", async () => {
    await createTask(db, { title: "a", due_date: "2026-11-17" }, NOW);
    await createTask(db, { title: "b", due_date: "2026-11-20" }, NOW);
    await createTask(db, { title: "c", due_date: "2026-11-30" }, NOW);
    expect((await listTasks(db, { from: "2026-11-18", to: "2026-11-25" }, NOW)).map((t) => t.title)).toEqual(["b"]);
  });

  it("считает подзадачи, подзадачи не попадают в view", async () => {
    const p = await createTask(db, { title: "parent", bucket: "today" }, NOW);
    const s1 = await createTask(db, { title: "s1", parent_id: p.id, bucket: "today" }, NOW);
    await createTask(db, { title: "s2", parent_id: p.id, bucket: "today" }, NOW);
    await toggleTask(db, s1.id, NOW);
    const got = await getTask(db, p.id, NOW);
    expect(got.subtasks).toHaveLength(2);
    expect(got.subtasks_total).toBe(2);
    expect(got.subtasks_done).toBe(1);
    expect((await listTasks(db, { view: "today" }, NOW)).map((t) => t.title)).toEqual(["parent"]);
  });

  it("удаление задачи удаляет подзадачи", async () => {
    const p = await createTask(db, { title: "parent" }, NOW);
    await createTask(db, { title: "s1", parent_id: p.id }, NOW);
    await deleteTask(db, p.id);
    expect(await listTasks(db, {}, NOW)).toEqual([]);
  });

  it("reorder меняет sort, bucket и section_id", async () => {
    const a = await createTask(db, { title: "a" }, NOW);
    const b = await createTask(db, { title: "b" }, NOW);
    await reorderTasks(db, [
      { id: a.id, sort: 5, bucket: "today" },
      { id: b.id, sort: 1, section_id: "sec1" },
    ], NOW);
    expect(await getTask(db, a.id, NOW)).toMatchObject({ sort: 5, bucket: "today" });
    expect(await getTask(db, b.id, NOW)).toMatchObject({ sort: 1, section_id: "sec1", bucket: "inbox" });
    expect((await listTasks(db, {}, NOW)).map((t) => t.title)).toEqual(["b", "a"]);
  });

  it("reorder неизвестной задачи → NotFoundError, остальные откатываются", async () => {
    const a = await createTask(db, { title: "a" }, NOW);
    await expect(reorderTasks(db, [{ id: a.id, sort: 9 }, { id: "nope", sort: 1 }], NOW)).rejects.toThrow(NotFoundError);
    expect((await getTask(db, a.id, NOW)).sort).toBe(0);
  });

  it("несуществующая задача → NotFoundError", async () => {
    await expect(getTask(db, "nope")).rejects.toThrow(NotFoundError);
    await expect(toggleTask(db, "nope")).rejects.toThrow(NotFoundError);
  });

  it("удаление категории обнуляет category_id у задач", async () => {
    const c = await createCategory(db, { name: "Работа", color: "#2e5eff" });
    const t = await createTask(db, { title: "x", category_id: c.id }, NOW);
    await deleteCategory(db, c.id);
    expect((await getTask(db, t.id, NOW)).category_id).toBeNull();
  });
});
