import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import type { Db } from "../db/factory";
import {
  agent_activity,
  events,
  goals,
  mcp_tokens,
  notes,
  project_sections,
  projects,
  tasks,
  type AgentActivityRow,
} from "../db/schema";
import { NotFoundError, newId, nowIso } from "./common";
import { deleteGoal } from "./goals";
import { deleteProject } from "./projects";
import { deleteSection } from "./sections";
import { deleteTask } from "./tasks";

export type EntityType = AgentActivityRow["entity_type"];
export type ActivityAction = AgentActivityRow["action"];

export interface ActivityItem {
  id: string;
  token_id: string | null;
  token_name: string;
  tool: string;
  entity_type: EntityType;
  entity_id: string;
  action: ActivityAction;
  summary: string;
  created_at: string;
  undone_at: string | null;
  can_undo: boolean;
}

export interface LogActivityInput {
  token_id: string | null;
  tool: string;
  entity_type: EntityType;
  entity_id: string;
  action: ActivityAction;
  summary: string;
  /** Снимок(и) строк БД до изменения (update/delete). Для задачи при delete: `{ task, subtasks }`. */
  before?: unknown;
  /** Снимок после изменения (create/update). */
  after?: unknown;
}

const TABLES = {
  task: tasks,
  project: projects,
  section: project_sections,
  event: events,
  note: notes,
  goal: goals,
} as const;

/** Все таблицы имеют `id`; типизируем как одну, чтобы работать с ними обобщённо. */
type AnyTable = typeof tasks;
const tableOf = (type: EntityType) => TABLES[type] as unknown as AnyTable;

type Row = Record<string, unknown>;

/** Строка сущности как есть в БД (или null). Годится как снимок для журнала. */
export async function snapshotEntity(db: Db, type: EntityType, id: string): Promise<Row | null> {
  const t = tableOf(type);
  const res = await db.select().from(t).where(eq(t.id, id)).get();
  return (res as Row | undefined) ?? null;
}

export async function entityExists(db: Db, type: EntityType, id: string): Promise<boolean> {
  const t = tableOf(type);
  const row = await db.select({ id: t.id }).from(t).where(eq(t.id, id)).get();
  return row !== undefined;
}

/** Помечает сущность как созданную агентом (у колонок нет `source` только у секций). */
export async function markAgent(db: Db, type: EntityType, id: string): Promise<void> {
  if (type === "section") return;
  const t = tableOf(type);
  await db.update(t).set({ source: "agent" }).where(eq(t.id, id)).run();
}

export async function logActivity(db: Db, input: LogActivityInput, now: Date = new Date()): Promise<string> {
  const id = newId();
  await db.insert(agent_activity)
    .values({
      id,
      token_id: input.token_id,
      tool: input.tool,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      action: input.action,
      summary: input.summary,
      before: input.before === undefined ? null : JSON.stringify(input.before),
      after: input.after === undefined ? null : JSON.stringify(input.after),
      undone_at: null,
      created_at: nowIso(now),
    })
    .run();
  return id;
}

const parse = (s: string | null): unknown => {
  if (s === null) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

/** Почему отменить нельзя (null — можно). */
async function undoBlocker(db: Db, row: AgentActivityRow): Promise<string | null> {
  if (row.undone_at) return "Это действие уже отменено";
  const exists = await entityExists(db, row.entity_type, row.entity_id);
  if (row.action === "delete") {
    if (exists) return "Нельзя восстановить: такой объект уже существует";
    if (parse(row.before) === null) return "Нельзя восстановить: нет сохранённой копии";
    return null;
  }
  if (!exists) return "Нельзя отменить: объект уже удалён";
  if (row.action === "update" && (parse(row.before) === null || parse(row.after) === null)) {
    return "Нельзя отменить: нет сохранённой копии";
  }
  return null;
}

async function toItem(db: Db, row: AgentActivityRow, tokenName: string | null): Promise<ActivityItem> {
  const blocker = await undoBlocker(db, row);
  return {
    id: row.id,
    token_id: row.token_id,
    token_name: tokenName ?? "удалённый ключ",
    tool: row.tool,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    action: row.action,
    summary: row.summary,
    created_at: row.created_at,
    undone_at: row.undone_at,
    can_undo: blocker === null,
  };
}

/**
 * Курсор «Показать ещё»: id последней записи предыдущей страницы.
 * Сравниваем пару (created_at, rowid), потому что plan_project пишет много записей
 * с одинаковым временем и курсор только по времени пропустил бы часть из них.
 * Для совместимости принимается и ISO-время.
 */
async function cursorWhere(db: Db, before: string | undefined) {
  if (!before) return undefined;
  const ref = await db
    .select({ created_at: agent_activity.created_at, rowid: sql<number>`agent_activity.rowid` })
    .from(agent_activity)
    .where(eq(agent_activity.id, before))
    .get();
  if (!ref) return lt(agent_activity.created_at, before);
  return or(
    lt(agent_activity.created_at, ref.created_at),
    and(eq(agent_activity.created_at, ref.created_at), sql`agent_activity.rowid < ${ref.rowid}`),
  );
}

export async function listActivity(db: Db, opts: { limit?: number; before?: string } = {}): Promise<ActivityItem[]> {
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 50), 1), 200);
  const where = await cursorWhere(db, opts.before);
  const rows = await db
    .select({ a: agent_activity, token_name: mcp_tokens.name })
    .from(agent_activity)
    .leftJoin(mcp_tokens, eq(mcp_tokens.id, agent_activity.token_id))
    .where(where)
    .orderBy(desc(agent_activity.created_at), sql`agent_activity.rowid desc`)
    .limit(limit)
    .all();
  return await Promise.all(rows.map((r) => toItem(db, r.a, r.token_name)));
}

async function getItem(db: Db, id: string): Promise<ActivityItem> {
  const r = await db
    .select({ a: agent_activity, token_name: mcp_tokens.name })
    .from(agent_activity)
    .leftJoin(mcp_tokens, eq(mcp_tokens.id, agent_activity.token_id))
    .where(eq(agent_activity.id, id))
    .get();
  if (!r) throw new NotFoundError("Запись журнала");
  return await toItem(db, r.a, r.token_name);
}

/** Откатывает действие агента. Всё — в одной транзакции вместе с пометкой `undone_at`. */
export async function undoActivity(db: Db, id: string, now: Date = new Date()): Promise<ActivityItem> {
  await db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Db;
    const row = await tx.select().from(agent_activity).where(eq(agent_activity.id, id)).get();
    if (!row) throw new NotFoundError("Запись журнала");
    const blocker = await undoBlocker(tx, row);
    if (blocker) throw new RangeError(blocker);

    const type = row.entity_type;
    const t = tableOf(type);

    if (row.action === "create") {
      switch (type) {
        case "task":
          await deleteTask(tx, row.entity_id);
          break;
        case "project":
          await deleteProject(tx, row.entity_id);
          break;
        case "section":
          await deleteSection(tx, row.entity_id);
          break;
        case "goal":
          await deleteGoal(tx, row.entity_id);
          break;
        default:
          await tx.delete(t).where(eq(t.id, row.entity_id)).run();
      }
    } else if (row.action === "update") {
      const before = parse(row.before) as Row;
      const after = parse(row.after) as Row;
      const set: Row = {};
      for (const key of Object.keys(before)) {
        if (key === "id" || key === "created_at") continue;
        if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) set[key] = before[key];
      }
      if (Object.keys(set).length > 0) {
        if ("updated_at" in before) set.updated_at = nowIso(now);
        await tx.update(t).set(set as never).where(eq(t.id, row.entity_id)).run();
      }
    } else {
      const before = parse(row.before) as Row;
      if (type === "task" && "task" in before) {
        const snap = before as { task: Row; subtasks?: Row[] };
        await tx.insert(tasks).values(snap.task as never).run();
        for (const s of snap.subtasks ?? []) await tx.insert(tasks).values(s as never).run();
      } else {
        await tx.insert(t).values(before as never).run();
      }
    }

    await tx.update(agent_activity).set({ undone_at: nowIso(now) }).where(eq(agent_activity.id, id)).run();
  });
  return await getItem(db, id);
}
