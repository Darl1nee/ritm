import { and, asc, eq, gt, lt } from "drizzle-orm";
import type { Db } from "../db/factory";
import { events, type EventRow } from "../db/schema";
import type { EventCreate, EventRange, EventUpdate } from "@/shared/schemas";
import { NotFoundError, clean, newId, nowIso, rangeToIso, toUtcIso } from "./common";

export type CalendarEvent = EventRow;

/** События, пересекающие диапазон дат [from, to] включительно (локальные сутки). */
export async function listEvents(db: Db, range: EventRange): Promise<CalendarEvent[]> {
  const { start, end } = rangeToIso(range.from, range.to);
  return await db
    .select()
    .from(events)
    .where(and(lt(events.start_at, end), gt(events.end_at, start)))
    .orderBy(asc(events.start_at))
    .all();
}

export async function getEvent(db: Db, id: string): Promise<CalendarEvent> {
  const row = await db.select().from(events).where(eq(events.id, id)).get();
  if (!row) throw new NotFoundError("Событие");
  return row;
}

export async function createEvent(db: Db, input: EventCreate): Promise<CalendarEvent> {
  const ts = nowIso();
  const id = newId();
  await db.insert(events)
    .values({
      id,
      title: input.title,
      type: input.type ?? "other",
      start_at: toUtcIso(input.start_at),
      end_at: toUtcIso(input.end_at),
      all_day: input.all_day ?? false,
      location: input.location ?? "",
      notes: input.notes ?? "",
      project_id: input.project_id ?? null,
      created_at: ts,
      updated_at: ts,
    })
    .run();
  return await getEvent(db, id);
}

export async function updateEvent(db: Db, id: string, patch: EventUpdate): Promise<CalendarEvent> {
  const current = await getEvent(db, id);
  const set: Partial<EventRow> = { ...clean(patch), updated_at: nowIso() };
  if (patch.start_at) set.start_at = toUtcIso(patch.start_at);
  if (patch.end_at) set.end_at = toUtcIso(patch.end_at);
  const start = set.start_at ?? current.start_at;
  const end = set.end_at ?? current.end_at;
  if (Date.parse(end) < Date.parse(start)) throw new RangeError("end_at раньше start_at");
  await db.update(events).set(set).where(eq(events.id, id)).run();
  return await getEvent(db, id);
}

export async function deleteEvent(db: Db, id: string): Promise<{ id: string }> {
  await getEvent(db, id);
  await db.delete(events).where(eq(events.id, id)).run();
  return { id };
}
