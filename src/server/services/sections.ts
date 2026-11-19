import { eq } from "drizzle-orm";
import type { Db } from "../db/factory";
import { projects, project_sections, tasks, type SectionRow } from "../db/schema";
import type { SectionCreate, SectionUpdate } from "@/shared/schemas";
import { NotFoundError, clean, newId, nowIso } from "./common";

export type Section = SectionRow;

export async function createSection(db: Db, projectId: string, input: SectionCreate): Promise<Section> {
  const proj = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).get();
  if (!proj) {
    throw new NotFoundError("Проект");
  }
  const ts = nowIso();
  const existing = await db.select().from(project_sections).where(eq(project_sections.project_id, projectId)).all();
  const row: Section = {
    id: newId(),
    project_id: projectId,
    title: input.title,
    sort: input.sort ?? existing.reduce((m, s) => Math.max(m, s.sort), -1) + 1,
    created_at: ts,
    updated_at: ts,
  };
  await db.insert(project_sections).values(row).run();
  return row;
}

async function getSection(db: Db, id: string): Promise<Section> {
  const row = await db.select().from(project_sections).where(eq(project_sections.id, id)).get();
  if (!row) throw new NotFoundError("Секция");
  return row;
}

export async function updateSection(db: Db, id: string, patch: SectionUpdate): Promise<Section> {
  await getSection(db, id);
  await db.update(project_sections).set({ ...clean(patch), updated_at: nowIso() }).where(eq(project_sections.id, id)).run();
  return await getSection(db, id);
}

/** Удаляет секцию; её задачи остаются в проекте без секции. */
export async function deleteSection(db: Db, id: string): Promise<{ id: string }> {
  await getSection(db, id);
  await db.transaction(async (tx) => {
    await tx.update(tasks).set({ section_id: null }).where(eq(tasks.section_id, id)).run();
    await tx.delete(project_sections).where(eq(project_sections.id, id)).run();
  });
  return { id };
}
