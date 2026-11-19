import { desc, gte, lt, and } from "drizzle-orm";
import type { Db } from "../db/factory";
import { focus_sessions, type FocusRow } from "../db/schema";
import { todayStr } from "@/shared/dates";
import type { FocusCreate } from "@/shared/schemas";
import { newId, nowIso, rangeToIso, toUtcIso } from "./common";
import { getSettings } from "./settings";

export type FocusSession = FocusRow;
export interface FocusToday {
  date: string;
  minutes: number;
  sessions: number;
  goal_min: number;
  items: FocusSession[];
}

/** Записать завершённую фокус-сессию. */
export async function createFocus(db: Db, input: FocusCreate): Promise<FocusSession> {
  const ts = nowIso();
  const row: FocusSession = {
    id: newId(),
    started_at: toUtcIso(input.started_at),
    ended_at: toUtcIso(input.ended_at),
    duration_min: input.duration_min,
    task_id: input.task_id ?? null,
    created_at: ts,
    updated_at: ts,
  };
  await db.insert(focus_sessions).values(row).run();
  return row;
}

/** Сессии за период [from, to] (локальные даты); без аргументов — последние 100. */
export async function listFocus(db: Db, range?: { from?: string; to?: string }): Promise<FocusSession[]> {
  const where = [];
  if (range?.from) where.push(gte(focus_sessions.started_at, rangeToIso(range.from, range.from).start));
  if (range?.to) where.push(lt(focus_sessions.started_at, rangeToIso(range.to, range.to).end));
  return await db
    .select()
    .from(focus_sessions)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(focus_sessions.started_at))
    .limit(100)
    .all();
}

export async function focusToday(db: Db, now: Date = new Date()): Promise<FocusToday> {
  const date = todayStr(now);
  const items = (await listFocus(db, { from: date, to: date })).reverse();
  const settings = await getSettings(db);
  return {
    date,
    minutes: items.reduce((s, i) => s + i.duration_min, 0),
    sessions: items.length,
    goal_min: settings.focus_goal_min,
    items,
  };
}
