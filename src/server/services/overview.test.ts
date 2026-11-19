import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-db";
import type { Db } from "../db/factory";
import { seed } from "../db/seed";
import { getOverview } from "./overview";
import { search } from "./search";
import { listTasks } from "./tasks";
import { getSettings, updateSettings } from "./settings";

const NOW = new Date(2026, 10, 18, 12, 0, 0);
let db: Db;

beforeEach(async () => {
  db = await createTestDb();
});

describe("seed + overview + search + settings", () => {
  it("сид идемпотентен и наполняет данные", async () => {
    await seed(db, NOW);
    const count = (await listTasks(db, {}, NOW)).length;
    await seed(db, NOW);
    expect(await listTasks(db, {}, NOW)).toHaveLength(count);
    expect(count).toBeGreaterThanOrEqual(15);
  });

  it("overview собирает всё для Обзора", async () => {
    await seed(db, NOW);
    const o = await getOverview(db, NOW);
    expect(o.user_name).toBe("Рамазан");
    expect(o.week).toHaveLength(7);
    expect(o.tasks_today.overdue).toBeGreaterThanOrEqual(1);
    expect(o.tasks_today.total).toBe(o.tasks_today.done + o.tasks_today.items.length);
    expect(o.focus.sessions).toBe(2);
    expect(o.focus.minutes).toBe(50);
    expect(o.focus.goal_min).toBe(120);
    expect(o.projects).toHaveLength(3);
  });

  it("search находит по кириллице без учёта регистра", async () => {
    await seed(db, NOW);
    const r = await search(db, "КУРС");
    expect(r.results.length).toBeGreaterThan(0);
    expect(r.results.some((x) => x.type === "project")).toBe(true);
    expect((await search(db, "  ")).results).toEqual([]);
  });

  it("settings: дефолты + частичное обновление", async () => {
    expect((await getSettings(db)).focus_length_min).toBe(25);
    await updateSettings(db, { theme: "dark", focus_length_min: 50 });
    expect(await getSettings(db)).toMatchObject({ theme: "dark", focus_length_min: 50, accent: "#2e5eff" });
  });
});
