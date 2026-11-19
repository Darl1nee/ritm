import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createTestDb } from "../db/test-db";
import type { Db } from "../db/factory";
import { agent_activity, events, notes, project_sections, tasks } from "../db/schema";
import { createMcpToken } from "../services/mcp-tokens";
import { createNote } from "../services/notes";
import { createProject, getProject } from "../services/projects";
import { createTask } from "../services/tasks";
import { createCategory } from "../services/categories";
import { listActivity, undoActivity } from "../services/activity";
import { ALL_SCOPES, READ_ONLY_SCOPES, type Scope } from "./scopes";
import { createRitmMcpServer } from "./server";

// Среда, 18 ноября 2026, 12:00 локально
const NOW = new Date(2026, 10, 18, 12, 0, 0);

async function connect(db: Db, scopes: Scope[]) {
  const { record } = await createMcpToken(db, { name: "Агент", scopes });
  const server = createRitmMcpServer({ db, token: record, now: () => NOW });
  const client = new Client({ name: "test", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client, record };
}

type Client_ = Awaited<ReturnType<typeof connect>>["client"];

async function call(client: Client_, name: string, args: Record<string, unknown> = {}) {
  const res = (await client.callTool({ name, arguments: args })) as {
    isError?: boolean;
    content: { type: string; text: string }[];
  };
  const text = res.content[0].text;
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* сообщение об ошибке — обычный текст */
  }
  return { isError: res.isError === true, data: data as any, text }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const toolNames = async (client: Client_) => (await client.listTools()).tools.map((t) => t.name).sort();

describe("права и список инструментов", () => {
  it("ключ только с tasks:read видит чтение задач + get_context + search; записи нет", async () => {
    const { client } = await connect(await createTestDb(), ["tasks:read"]);
    expect(await toolNames(client)).toEqual(["get_context", "get_overview", "get_task", "list_categories", "list_tasks", "search"]);
    const res = await call(client, "create_task", { title: "x" });
    expect(res.isError).toBe(true);
    const info = await call(client, "get_context");
    expect(info.data.scopes).toEqual(["tasks:read"]);
  });

  it("полный ключ: все инструменты, аннотации, промпты", async () => {
    const { client } = await connect(await createTestDb(), ALL_SCOPES);
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(30);
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    expect(byName.list_tasks.annotations).toMatchObject({ readOnlyHint: true, openWorldHint: false });
    expect(byName.delete_task.annotations).toMatchObject({ destructiveHint: true, readOnlyHint: false });
    expect(byName.create_task.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false });
    expect(tools.every((t) => t.title && t.description)).toBe(true);
    expect((await client.listPrompts()).prompts.map((p) => p.name).sort()).toEqual(["break_down_project", "plan_week"]);
    expect(client.getInstructions()).toContain("get_context");
  });

  it("только чтение — ни одного инструмента записи", async () => {
    const { client } = await connect(await createTestDb(), READ_ONLY_SCOPES);
    const names = await toolNames(client);
    expect(names.filter((n) => /^(create|update|delete|add|rename|complete|plan)_/.test(n))).toEqual([]);
    expect(names).toContain("find_free_time");
  });
});

describe("задачи и журнал", () => {
  it("create_task: source=agent, подзадачи, запись в журнале; отмена удаляет", async () => {
    const db = await createTestDb();
    const { client } = await connect(db, ["tasks:read", "tasks:write"]);
    const res = await call(client, "create_task", { title: "Купить билеты", due_date: "2026-11-20", subtasks: ["Выбрать рейс", "Оплатить"] });
    expect(res.isError).toBe(false);
    expect(res.data).toMatchObject({ title: "Купить билеты", due_date: "2026-11-20", view: "week", subtasks_total: 2 });
    expect(res.data.subtasks).toHaveLength(2);
    expect(res.data).not.toHaveProperty("sort");
    expect(res.data).not.toHaveProperty("created_at");

    const rows = await db.select().from(tasks).all();
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.source === "agent")).toBe(true);

    const log = await listActivity(db);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ tool: "create_task", action: "create", entity_type: "task", summary: "Создана задача «Купить билеты»", token_name: "Агент", can_undo: true });

    await undoActivity(db, log[0].id);
    expect(await db.select().from(tasks).all()).toHaveLength(0);
  });

  it("update_task: отмена возвращает старые значения, summary про перенос", async () => {
    const db = await createTestDb();
    const { client } = await connect(db, ["tasks:write", "tasks:read"]);
    const t = await createTask(db, { title: "Отчёт", due_date: "2026-11-19", due_time: "10:00", priority: 1 }, NOW);
    const res = await call(client, "update_task", { id: t.id, due_date: "2026-11-20", due_time: null, priority: 3 });
    expect(res.data).toMatchObject({ due_date: "2026-11-20", priority: 3 });
    expect(res.data).not.toHaveProperty("due_time");

    const [entry] = await listActivity(db);
    expect(entry.summary).toBe("Задача «Отчёт» перенесена на 20 нояб");
    await undoActivity(db, entry.id);
    const row = (await db.select().from(tasks).where(eq(tasks.id, t.id)).get())!;
    expect(row).toMatchObject({ due_date: "2026-11-19", due_time: "10:00", priority: 1 });
  });

  it("complete_task выставляет completed_at, отмена снимает", async () => {
    const db = await createTestDb();
    const { client } = await connect(db, ["tasks:write"]);
    const t = await createTask(db, { title: "x" }, NOW);
    await call(client, "complete_task", { id: t.id });
    expect(await db.select().from(tasks).get()).toMatchObject({ done: true, completed_at: NOW.toISOString() });
    const log = await listActivity(db);
    await undoActivity(db, log[0].id);
    expect(await db.select().from(tasks).get()).toMatchObject({ done: false, completed_at: null });
  });

  it("delete_task с подзадачами: отмена восстанавливает всё с теми же id", async () => {
    const db = await createTestDb();
    const { client } = await connect(db, ["tasks:write"]);
    const t = await createTask(db, { title: "Родитель" }, NOW);
    const s1 = await createTask(db, { title: "Под 1", parent_id: t.id }, NOW);
    const s2 = await createTask(db, { title: "Под 2", parent_id: t.id, done: true }, NOW);
    const snapshot = await db.select().from(tasks).all();

    const res = await call(client, "delete_task", { id: t.id });
    expect(res.data.deleted).toMatchObject({ id: t.id, subtasks: 2 });
    expect(await db.select().from(tasks).all()).toHaveLength(0);

    const [entry] = await listActivity(db);
    expect(entry.summary).toBe("Удалена задача «Родитель»");
    await undoActivity(db, entry.id);
    const restored = await db.select().from(tasks).all();
    expect(restored.map((r) => r.id).sort()).toEqual([t.id, s1.id, s2.id].sort());
    expect(restored.sort((a, b) => a.id.localeCompare(b.id))).toEqual(snapshot.sort((a, b) => a.id.localeCompare(b.id)));
  });

  it("несуществующая задача и неверные параметры → isError, а не исключение", async () => {
    const { client } = await connect(await createTestDb(), ["tasks:read", "tasks:write"]);
    const a = await call(client, "get_task", { id: "nope" });
    expect(a).toMatchObject({ isError: true, text: "Задача: не найдено" });
    const b = await call(client, "create_task", { title: "x", category_id: "nope" });
    expect(b).toMatchObject({ isError: true, text: "Категория: не найдено" });
    const c = await call(client, "create_task", { title: "x", due_date: "завтра" });
    expect(c.isError).toBe(true);
    const d = await call(client, "update_task", { id: "nope" });
    expect(d.isError).toBe(true);
  });

  it("list_tasks: компактный вид с категорией и проектом, limit", async () => {
    const db = await createTestDb();
    const { client } = await connect(db, ["tasks:read"]);
    const cat = await createCategory(db, { name: "Работа", color: "#2e5eff" });
    const p = await createProject(db, { title: "Сайт" }, NOW);
    await createTask(db, { title: "a", category_id: cat.id, project_id: p.id, due_date: "2026-11-10" }, NOW);
    await createTask(db, { title: "b" }, NOW);
    const res = await call(client, "list_tasks", { limit: 1 });
    expect(res.data).toMatchObject({ total: 2, returned: 1 });
    expect(res.data.tasks[0]).toMatchObject({
      title: "a",
      overdue: true,
      view: "today",
      category: { id: cat.id, name: "Работа" },
      project: { id: p.id, title: "Сайт" },
    });
  });
});

describe("plan_project", () => {
  it("создаёт колонки по названию (без учёта регистра), задачи, подзадачи и журнал", async () => {
    const db = await createTestDb();
    const { client } = await connect(db, ["projects:write", "tasks:write", "tasks:read", "projects:read"]);
    const p = await createProject(db, { title: "Запуск", type: "project" }, NOW); // Бэклог, В работе, Готово
    const res = await call(client, "plan_project", {
      project_id: p.id,
      tasks: [
        { title: "Идея", section: "бэклог" },
        { title: "Лендинг", section: "Дизайн", subtasks: ["Макет", "Тексты"], priority: 2 },
        { title: "Тесты", section: "ДИЗАЙН" },
        { title: "Без колонки" },
      ],
    });
    expect(res.isError).toBe(false);
    expect(res.data.created_tasks).toHaveLength(4);
    expect(res.data.created_sections.map((s: { title: string }) => s.title)).toEqual(["Дизайн"]);

    const sections = await db.select().from(project_sections).where(eq(project_sections.project_id, p.id)).all();
    expect(sections.map((s) => s.title).sort()).toEqual(["Бэклог", "Готово", "Дизайн", "В работе"].sort());
    const design = sections.find((s) => s.title === "Дизайн")!;
    const backlog = sections.find((s) => s.title === "Бэклог")!;
    const all = await db.select().from(tasks).all();
    expect(all).toHaveLength(6);
    expect(all.every((t) => t.source === "agent" && t.project_id === p.id)).toBe(true);
    expect(all.find((t) => t.title === "Идея")!.section_id).toBe(backlog.id);
    expect(all.filter((t) => t.section_id === design.id).map((t) => t.title).sort()).toEqual(["Лендинг", "Макет", "Тексты", "Тесты"]);
    expect((await getProject(db, p.id, NOW)).progress.total).toBe(4);

    const log = await listActivity(db);
    expect(log.filter((l) => l.entity_type === "section")).toHaveLength(1);
    expect(log.filter((l) => l.entity_type === "task")).toHaveLength(4);
    expect(log.every((l) => l.tool === "plan_project")).toBe(true);
  });

  it("ошибка в одной задаче откатывает всё: ни колонок, ни задач, ни журнала", async () => {
    const db = await createTestDb();
    const { client } = await connect(db, ["projects:write", "tasks:write"]);
    await createProject(db, { title: "Запуск" }, NOW);
    const sectionsBefore = (await db.select().from(project_sections).all()).length;
    const res = await call(client, "plan_project", {
      project_id: "fake_id",
      tasks: [
        { title: "Первая", section: "Новая колонка", subtasks: ["a"] },
        { title: "Вторая", section: "Ещё колонка" },
        { title: "Битая", category_id: "no-such-category" },
      ],
    });
    expect(res.isError).toBe(true);
    expect(await db.select().from(tasks).all()).toHaveLength(0);
    expect((await db.select().from(project_sections).all()).length).toBe(sectionsBefore);
    expect(await db.select().from(agent_activity).all()).toHaveLength(0);
  });

  it("недоступен без tasks:write", async () => {
    const { client } = await connect(await createTestDb(), ["projects:write"]);
    expect(await toolNames(client)).not.toContain("plan_project");
    expect(await toolNames(client)).toContain("create_project");
  });
});

describe("изоляция по правам", () => {
  it("search не отдаёт заметки без notes:read", async () => {
    const db = await createTestDb();
    await createNote(db, { title: "Секретный план", body: "план" });
    await createTask(db, { title: "План на неделю" }, NOW);
    const noNotes = await connect(db, ["tasks:read"]);
    const r1 = await call(noNotes.client, "search", { q: "план" });
    expect(r1.data.results.map((r: { type: string }) => r.type)).toEqual(["task"]);
    const withNotes = await connect(db, ["tasks:read", "notes:read"]);
    const r2 = await call(withNotes.client, "search", { q: "план" });
    expect(r2.data.results.map((r: { type: string }) => r.type).sort()).toEqual(["note", "task"]);
  });

  it("search недоступен ключу только с правами записи", async () => {
    const { client } = await connect(await createTestDb(), ["tasks:write", "notes:write"]);
    expect(await toolNames(client)).not.toContain("search");
  });

  it("get_project не отдаёт задачи без tasks:read", async () => {
    const db = await createTestDb();
    const p = await createProject(db, { title: "Сайт" }, NOW);
    await createTask(db, { title: "Задача проекта", project_id: p.id }, NOW);
    const a = await connect(db, ["projects:read"]);
    const r1 = await call(a.client, "get_project", { id: p.id });
    expect(r1.data.title).toBe("Сайт");
    expect(r1.data.sections).toHaveLength(3);
    expect(r1.data).not.toHaveProperty("tasks");
    expect(r1.text).not.toContain("Задача проекта");
    const b = await connect(db, ["projects:read", "tasks:read"]);
    const r2 = await call(b.client, "get_project", { id: p.id });
    expect(r2.data.tasks.map((t: { title: string }) => t.title)).toEqual(["Задача проекта"]);
  });

  it("get_overview без calendar:read/projects:read не содержит их блоков", async () => {
    const db = await createTestDb();
    const a = await connect(db, ["tasks:read"]);
    const r1 = await call(a.client, "get_overview");
    expect(r1.data).toHaveProperty("tasks_today");
    expect(r1.data).not.toHaveProperty("events_today");
    expect(r1.data).not.toHaveProperty("projects");
    const b = await connect(db, ["tasks:read", "calendar:read", "projects:read"]);
    const r2 = await call(b.client, "get_overview");
    expect(r2.data).toHaveProperty("events_today");
    expect(r2.data).toHaveProperty("projects");
  });
});

describe("календарь и заметки", () => {
  it("find_free_time учитывает события, all-day, задачи со временем и текущий момент", async () => {
    const db = await createTestDb();
    const { client } = await connect(db, ["calendar:read", "calendar:write", "tasks:read"]);
    await call(client, "create_event", { title: "Созвон", type: "meeting", start_at: new Date(2026, 10, 18, 14, 0).toISOString(), end_at: new Date(2026, 10, 18, 15, 0).toISOString() });
    await call(client, "create_event", { title: "Отпуск", start_at: new Date(2026, 10, 19, 0, 0).toISOString(), end_at: new Date(2026, 10, 19, 0, 0).toISOString(), all_day: true });
    await createTask(db, { title: "Звонок", due_date: "2026-11-20", due_time: "10:00", duration_min: 60 }, NOW);

    const res = await call(client, "find_free_time", { from: "2026-11-18", to: "2026-11-20" });
    expect(res.isError).toBe(false);
    const days = Object.fromEntries(res.data.days.map((d: { date: string; free: unknown }) => [d.date, d.free]));
    expect(days["2026-11-18"]).toEqual([
      { start: "12:00", end: "14:00", minutes: 120 },
      { start: "15:00", end: "21:00", minutes: 360 },
    ]);
    expect(days["2026-11-19"]).toEqual([]);
    expect(days["2026-11-20"]).toEqual([
      { start: "09:00", end: "10:00", minutes: 60 },
      { start: "11:00", end: "21:00", minutes: 600 },
    ]);
    expect((await db.select().from(events).all()).every((e) => e.source === "agent")).toBe(true);

    expect((await call(client, "find_free_time", { from: "2026-11-20", to: "2026-11-18" })).isError).toBe(true);
    expect((await call(client, "list_events", { from: "2026-01-01", to: "2026-12-31" })).isError).toBe(true);
  });

  it("заметки: append_body, обрезка в списке, удаление и отмена", async () => {
    const db = await createTestDb();
    const { client } = await connect(db, ["notes:read", "notes:write"]);
    const created = await call(client, "create_note", { title: "Идеи", body: "x".repeat(500), kind: "idea" });
    const id = created.data.id as string;
    const list = await call(client, "list_notes", {});
    expect(list.data.notes[0].body).toHaveLength(301);
    expect(list.data.notes[0].body_truncated).toBe(true);
    const full = await call(client, "get_note", { id });
    expect(full.data.body).toHaveLength(500);

    const upd = await call(client, "update_note", { id, append_body: "добавка" });
    expect(upd.data.body.endsWith("\nдобавка")).toBe(true);

    await call(client, "delete_note", { id });
    expect(await db.select().from(notes).all()).toHaveLength(0);
    const log = await listActivity(db);
    await undoActivity(db, log[0].id);
    expect((await db.select().from(notes).get())?.id).toBe(id);
  });
});

describe("проекты и цели", () => {
  it("create_project создаёт секции по шаблону; отмена удаляет проект целиком", async () => {
    const db = await createTestDb();
    const { client } = await connect(db, ["projects:write", "projects:read", "goals:write", "goals:read"]);
    const res = await call(client, "create_project", { title: "Поездка", type: "trip" });
    expect(res.data.sections.map((s: { title: string }) => s.title)).toEqual(["Маршрут", "Брони", "Сборы"]);
    const sec = await call(client, "add_section", { project_id: res.data.id, title: "Визы" });
    await call(client, "rename_section", { id: sec.data.id, title: "Документы" });
    expect((await call(client, "get_project", { id: res.data.id })).data.sections).toHaveLength(4);

    const g = await call(client, "create_goal", { title: "Выучить язык" });
    await call(client, "update_goal", { id: g.data.id, status: "done" });
    expect((await call(client, "list_goals", { status: "done" })).data).toHaveLength(1);

    const log = await listActivity(db);
    expect(log.map((l) => l.tool)).toEqual(["update_goal", "create_goal", "rename_section", "add_section", "create_project"]);
    await undoActivity(db, log[4].id);
    expect(await db.select().from(project_sections).all()).toHaveLength(0);
  });
});
