import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db/factory";
import { notes, type NoteRow } from "../db/schema";
import type { NoteCreate, NoteFilters, NoteUpdate } from "@/shared/schemas";
import { NotFoundError, clean, matches, newId, nowIso } from "./common";

export type Note = NoteRow;

/** Закреплённые сверху, затем по свежести. */
export async function listNotes(db: Db, filters: NoteFilters = {}): Promise<Note[]> {
  const where = [];
  if (filters.kind) where.push(eq(notes.kind, filters.kind));
  if (filters.project_id) where.push(eq(notes.project_id, filters.project_id));
  let rows = await db
    .select()
    .from(notes)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(notes.pinned), desc(notes.updated_at))
    .all();
  if (filters.q) rows = rows.filter((n) => matches(filters.q!, n.title, n.body));
  return rows;
}

export async function getNote(db: Db, id: string): Promise<Note> {
  const row = await db.select().from(notes).where(eq(notes.id, id)).get();
  if (!row) throw new NotFoundError("Заметка");
  return row;
}

export async function createNote(db: Db, input: NoteCreate): Promise<Note> {
  const ts = nowIso();
  const id = newId();
  await db.insert(notes)
    .values({
      id,
      title: input.title ?? "",
      body: input.body ?? "",
      kind: input.kind ?? "note",
      project_id: input.project_id ?? null,
      pinned: input.pinned ?? false,
      created_at: ts,
      updated_at: ts,
    })
    .run();
  return await getNote(db, id);
}

export async function updateNote(db: Db, id: string, patch: NoteUpdate): Promise<Note> {
  await getNote(db, id);
  await db.update(notes).set({ ...clean(patch), updated_at: nowIso() }).where(eq(notes.id, id)).run();
  return await getNote(db, id);
}

export async function deleteNote(db: Db, id: string): Promise<{ id: string }> {
  await getNote(db, id);
  await db.delete(notes).where(eq(notes.id, id)).run();
  return { id };
}
