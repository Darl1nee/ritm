import type { Db } from "../db/factory";
import { tasks, projects, notes, events } from "../db/schema";
import { format } from "date-fns";
import { matches } from "./common";

export interface SearchResult {
  type: "task" | "project" | "note" | "event";
  id: string;
  title: string;
  subtitle: string | null;
}

const LIMIT_PER_TYPE = 8;

/** Поиск по задачам, проектам, заметкам и событиям (для палитры команд). */
export async function search(db: Db, q: string): Promise<{ query: string; results: SearchResult[] }> {
  const query = q.trim();
  if (!query) return { query, results: [] };
  const results: SearchResult[] = [];

  const [allTasks, allProjects, allNotes, allEvents] = await Promise.all([
    db.select().from(tasks).all(),
    db.select().from(projects).all(),
    db.select().from(notes).all(),
    db.select().from(events).all(),
  ]);

  allTasks
    .filter((t) => matches(query, t.title, t.notes))
    .slice(0, LIMIT_PER_TYPE)
    .forEach((t) => results.push({ type: "task", id: t.id, title: t.title, subtitle: t.due_date }));

  allProjects
    .filter((p) => matches(query, p.title, p.description))
    .slice(0, LIMIT_PER_TYPE)
    .forEach((p) => results.push({ type: "project", id: p.id, title: p.title, subtitle: p.type }));

  allNotes
    .filter((n) => matches(query, n.title, n.body))
    .slice(0, LIMIT_PER_TYPE)
    .forEach((n) =>
      results.push({ type: "note", id: n.id, title: n.title || n.body.slice(0, 60), subtitle: n.kind }),
    );

  allEvents
    .filter((e) => matches(query, e.title, e.location, e.notes))
    .slice(0, LIMIT_PER_TYPE)
    .forEach((e) =>
      results.push({ type: "event", id: e.id, title: e.title, subtitle: format(new Date(e.start_at), "yyyy-MM-dd HH:mm") }),
    );

  return { query, results };
}
