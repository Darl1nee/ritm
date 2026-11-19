import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-db";
import type { Db } from "../db/factory";
import { createGoal, getGoal } from "./goals";
import { createNote, getNote } from "./notes";
import { NotFoundError } from "./common";
import {
  SECTION_TEMPLATES,
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from "./projects";
import { createSection, deleteSection } from "./sections";
import { createTask, getTask, listTasks, toggleTask } from "./tasks";

const NOW = new Date(2026, 10, 18, 12, 0, 0);
let db: Db;

beforeEach(async () => {
  db = await createTestDb();
});

describe("projects service", () => {
  it.each(Object.entries(SECTION_TEMPLATES))("тип %s создаёт секции по шаблону", async (type, titles) => {
    const p = await createProject(db, { title: "P", type: type as keyof typeof SECTION_TEMPLATES }, NOW);
    expect(p.sections.map((s) => s.title)).toEqual(titles);
    expect(p.sections.map((s) => s.sort)).toEqual(titles.map((_, i) => i));
  });

  it("прогресс = выполненные / все задачи проекта", async () => {
    const p = await createProject(db, { title: "P" }, NOW);
    expect(p.progress).toEqual({ done: 0, total: 0, percent: 0 });
    const a = await createTask(db, { title: "a", project_id: p.id }, NOW);
    await createTask(db, { title: "b", project_id: p.id }, NOW);
    await createTask(db, { title: "c", project_id: p.id }, NOW);
    await createTask(db, { title: "d", project_id: p.id }, NOW);
    await toggleTask(db, a.id, NOW);
    const got = await getProject(db, p.id, NOW);
    expect(got.progress).toEqual({ done: 1, total: 4, percent: 25 });
    expect(got.tasks).toHaveLength(4);
    expect((await listProjects(db))[0].progress).toEqual({ done: 1, total: 4, percent: 25 });
  });

  it("подзадачи не входят в прогресс проекта", async () => {
    const p = await createProject(db, { title: "P" }, NOW);
    const t = await createTask(db, { title: "t", project_id: p.id }, NOW);
    await createTask(db, { title: "sub", project_id: p.id, parent_id: t.id }, NOW);
    expect((await getProject(db, p.id, NOW)).progress.total).toBe(1);
  });

  it("фильтры type, status и q (кириллица без учёта регистра)", async () => {
    await createProject(db, { title: "Запуск курса", type: "content" }, NOW);
    await createProject(db, { title: "Поездка", type: "trip", status: "paused" }, NOW);
    expect((await listProjects(db, { type: "trip" })).map((p) => p.title)).toEqual(["Поездка"]);
    expect((await listProjects(db, { status: "paused" })).map((p) => p.title)).toEqual(["Поездка"]);
    expect((await listProjects(db, { q: "КУРС" })).map((p) => p.title)).toEqual(["Запуск курса"]);
  });

  it("update не затирает необновлённые поля", async () => {
    const p = await createProject(db, { title: "P", color: "#f08c3a", emoji: "🎬" }, NOW);
    const u = await updateProject(db, p.id, { status: "paused" }, NOW);
    expect(u).toMatchObject({ status: "paused", color: "#f08c3a", emoji: "🎬", title: "P" });
  });

  it("удаление проекта удаляет секции и задачи, отвязывает заметки", async () => {
    const p = await createProject(db, { title: "P", type: "trip" }, NOW);
    const t = await createTask(db, { title: "t", project_id: p.id }, NOW);
    await createTask(db, { title: "sub", parent_id: t.id }, NOW);
    const keep = await createTask(db, { title: "other" }, NOW);
    const n = await createNote(db, { title: "n", project_id: p.id });
    await deleteProject(db, p.id);
    await expect(getProject(db, p.id)).rejects.toThrow(NotFoundError);
    expect((await listTasks(db, {}, NOW)).map((x) => x.id)).toEqual([keep.id]);
    expect((await getNote(db, n.id)).project_id).toBeNull();
  });

  it("секции: создание получает следующий sort, удаление освобождает задачи", async () => {
    const p = await createProject(db, { title: "P" }, NOW);
    const s = await createSection(db, p.id, { title: "Новая" });
    expect(s.sort).toBe(3);
    const t = await createTask(db, { title: "t", project_id: p.id, section_id: s.id }, NOW);
    await deleteSection(db, s.id);
    expect((await getTask(db, t.id, NOW)).section_id).toBeNull();
    await expect(createSection(db, "nope", { title: "x" })).rejects.toThrow(NotFoundError);
  });

  it("прогресс цели считается по привязанным задачам", async () => {
    const g = await createGoal(db, { title: "G" });
    const a = await createTask(db, { title: "a", goal_id: g.id }, NOW);
    await createTask(db, { title: "b", goal_id: g.id }, NOW);
    await toggleTask(db, a.id, NOW);
    expect((await getGoal(db, g.id)).progress).toEqual({ done: 1, total: 2, percent: 50 });
  });
});
