import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../db/test-db";
import type { Db } from "../db/factory";
import { tasks } from "../db/schema";
import { createMcpToken, deleteMcpToken, revokeMcpToken } from "./mcp-tokens";
import { createTask, deleteTask } from "./tasks";
import { NotFoundError } from "./common";
import { listActivity, logActivity, snapshotEntity, undoActivity } from "./activity";

const NOW = new Date(2026, 10, 18, 12, 0, 0);
let db: Db;
let tokenId: string;

beforeEach(async () => {
  db = await createTestDb();
  tokenId = (await createMcpToken(db, { name: "Тест", scopes: ["tasks:write"] })).record.id;
});

describe("activity", () => {
  it("listActivity: свежие первыми, название ключа, can_undo", async () => {
    const t = await createTask(db, { title: "a" }, NOW);
    await logActivity(db, { token_id: tokenId, tool: "create_task", entity_type: "task", entity_id: t.id, action: "create", summary: "один", after: await snapshotEntity(db, "task", t.id) }, new Date(NOW.getTime()));
    await logActivity(db, { token_id: tokenId, tool: "create_task", entity_type: "task", entity_id: "nope", action: "create", summary: "два" }, new Date(NOW.getTime() + 1000));
    const list = await listActivity(db);
    expect(list.map((i) => i.summary)).toEqual(["два", "один"]);
    expect(list[0]).toMatchObject({ token_name: "Тест", can_undo: false });
    expect(list[1].can_undo).toBe(true);
    expect(list[1]).not.toHaveProperty("before");
    expect((await listActivity(db, { before: list[0].created_at })).map((i) => i.summary)).toEqual(["один"]);
    expect(await listActivity(db, { limit: 1 })).toHaveLength(1);
  });

  it("удалённый ключ → «удалённый ключ»", async () => {
    await logActivity(db, { token_id: tokenId, tool: "x", entity_type: "task", entity_id: "t", action: "create", summary: "s" });
    await revokeMcpToken(db, tokenId);
    await deleteMcpToken(db, tokenId);
    expect((await listActivity(db))[0].token_name).toBe("удалённый ключ");
  });

  it("undo create удаляет, повторная отмена и отмена после удаления — RangeError", async () => {
    const t = await createTask(db, { title: "a" }, NOW);
    const id = await logActivity(db, { token_id: tokenId, tool: "create_task", entity_type: "task", entity_id: t.id, action: "create", summary: "s" });
    const item = await undoActivity(db, id, NOW);
    expect(item.undone_at).toBe(NOW.toISOString());
    expect(await snapshotEntity(db, "task", t.id)).toBeNull();
    await expect(undoActivity(db, id)).rejects.toThrow(/уже отменено/);

    const t2 = await createTask(db, { title: "b" }, NOW);
    const id2 = await logActivity(db, { token_id: tokenId, tool: "create_task", entity_type: "task", entity_id: t2.id, action: "create", summary: "s" });
    await deleteTask(db, t2.id);
    await expect(undoActivity(db, id2)).rejects.toThrow(RangeError);
    await expect(undoActivity(db, "nope")).rejects.toThrow(NotFoundError);
  });

  it("undo delete восстанавливает задачу с подзадачами; нельзя, если уже существует", async () => {
    const t = await createTask(db, { title: "a" }, NOW);
    const s = await createTask(db, { title: "sub", parent_id: t.id }, NOW);
    const before = { task: await snapshotEntity(db, "task", t.id), subtasks: [await snapshotEntity(db, "task", s.id)] };
    const id = await logActivity(db, { token_id: tokenId, tool: "delete_task", entity_type: "task", entity_id: t.id, action: "delete", summary: "s", before });
    await expect(undoActivity(db, id)).rejects.toThrow(/уже существует/);
    await deleteTask(db, t.id);
    await undoActivity(db, id);
    expect((await db.select().from(tasks).where(eq(tasks.id, s.id)).get())?.parent_id).toBe(t.id);
    expect(await snapshotEntity(db, "task", t.id)).toEqual(before.task);
  });
});

describe("listActivity: постраничность", () => {
  it("не теряет записи с одинаковым временем на границе страниц", async () => {
    const { createTestDb } = await import("../db/test-db");
    const { logActivity, listActivity } = await import("./activity");
    const db = await createTestDb();
    const at = new Date("2026-11-19T10:00:00Z");
    for (let i = 0; i < 7; i++) {
      await logActivity(db, { token_id: null, tool: "plan_project", entity_type: "task", entity_id: `t${i}`, action: "create", summary: `#${i}`, after: { id: `t${i}` } }, at);
    }
    const seen: string[] = [];
    let before: string | undefined;
    for (;;) {
      const page = await listActivity(db, { limit: 3, before });
      seen.push(...page.map((p) => p.entity_id));
      if (page.length < 3) break;
      before = page[page.length - 1].id;
    }
    expect(seen.sort()).toEqual(["t0", "t1", "t2", "t3", "t4", "t5", "t6"]);
  });
});
