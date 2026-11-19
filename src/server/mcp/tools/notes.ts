import { z } from "zod";
import { NOTE_KINDS, noteCreateSchema, noteUpdateSchema } from "@/shared/schemas";
import { createNote, deleteNote, getNote, listNotes, updateNote, type Note } from "@/server/services/notes";
import { markAgent, snapshotEntity } from "@/server/services/activity";
import { checkRefs, compact, defineTool, limitOf, log, must, q, write, type ToolCtx } from "./common";

const PREVIEW = 300;

function compactNote(n: Note, full: boolean) {
  const truncated = !full && n.body.length > PREVIEW;
  return compact({
    id: n.id,
    title: n.title,
    kind: n.kind,
    pinned: n.pinned || null,
    project_id: n.project_id,
    updated_at: n.updated_at,
    body: truncated ? n.body.slice(0, PREVIEW) + "…" : n.body,
    body_truncated: truncated || null,
  });
}

const label = (n: { title: string; kind: string }, fallback = "без названия") =>
  q(n.title || fallback);

export function registerNoteTools(ctx: ToolCtx) {
  const { db } = ctx;

  defineTool(ctx, {
    name: "list_notes",
    title: "Список заметок",
    description: "Заметки и идеи (закреплённые сверху). Тело обрезается до 300 символов — полный текст даёт get_note.",
    scopes: ["notes:read"],
    kind: "read",
    input: {
      kind: z.enum(NOTE_KINDS).optional().describe("note — заметки, idea — идеи"),
      q: z.string().optional().describe("Подстрока в названии или тексте"),
      project_id: z.string().optional().describe("Только заметки проекта"),
      limit: z.number().int().min(1).max(200).optional().describe("Сколько вернуть (по умолчанию 50, максимум 200)"),
    },
    run: async ({ limit, ...filters }) => {
      const all = await listNotes(db, filters);
      const lim = limitOf(limit);
      return { total: all.length, returned: Math.min(all.length, lim), notes: all.slice(0, lim).map((n) => compactNote(n, false)) };
    },
  });

  defineTool(ctx, {
    name: "get_note",
    title: "Заметка",
    description: "Заметка с полным текстом.",
    scopes: ["notes:read"],
    kind: "read",
    input: { id: z.string().describe("id заметки") },
    run: async ({ id }) => compactNote(await getNote(db, id), true),
  });

  defineTool(ctx, {
    name: "create_note",
    title: "Создать заметку",
    description: "Создаёт заметку или идею (markdown в body). Перед созданием поищите похожую, чтобы не плодить дубли.",
    scopes: ["notes:write"],
    kind: "write",
    input: {
      title: z.string().describe("Заголовок"),
      body: z.string().describe("Текст заметки (markdown)"),
      kind: z.enum(NOTE_KINDS).optional().describe("note (по умолчанию) или idea"),
      project_id: z.string().optional().describe("id проекта"),
      pinned: z.boolean().optional().describe("Закрепить сверху"),
    },
    run: async (raw) => {
      const input = noteCreateSchema.parse(raw);
      return await write(ctx, async (tx) => {
        await checkRefs(tx, input);
        const n = await createNote(tx, input);
        await markAgent(tx, "note", n.id);
        await log(tx, ctx, "create_note", "note", n.id, "create", `Создана заметка ${label(n)}`, undefined, await snapshotEntity(tx, "note", n.id));
        return compactNote(await getNote(tx, n.id), true);
      });
    },
  });

  defineTool(ctx, {
    name: "update_note",
    title: "Изменить заметку",
    description: "Меняет заметку. append_body дописывает текст в конец с новой строки, не затирая существующий.",
    scopes: ["notes:write"],
    kind: "write",
    input: {
      id: z.string().describe("id заметки"),
      title: z.string().optional().describe("Новый заголовок"),
      body: z.string().optional().describe("Новый текст целиком (заменяет старый)"),
      append_body: z.string().optional().describe("Текст, который нужно дописать в конец с новой строки"),
      kind: z.enum(NOTE_KINDS).optional().describe("note или idea"),
      project_id: z.string().nullable().optional().describe("id проекта; null — отвязать"),
      pinned: z.boolean().optional().describe("Закреплена ли"),
    },
    run: async ({ id, append_body, ...raw }) => {
      const patch = noteUpdateSchema.parse(raw);
      return await write(ctx, async (tx) => {
        const before = must(await snapshotEntity(tx, "note", id), "Заметка");
        if (append_body !== undefined) {
          const base = patch.body ?? String(before.body);
          patch.body = base ? `${base}\n${append_body}` : append_body;
        }
        if (!Object.values(patch).some((v) => v !== undefined)) throw new RangeError("Не указано ни одного поля для изменения");
        await checkRefs(tx, patch);
        await updateNote(tx, id, patch);
        const after = await snapshotEntity(tx, "note", id);
        await log(tx, ctx, "update_note", "note", id, "update", `Изменена заметка ${label({ title: String(after?.title ?? ""), kind: "" })}`, before, after);
        return compactNote(await getNote(tx, id), true);
      });
    },
  });

  defineTool(ctx, {
    name: "delete_note",
    title: "Удалить заметку",
    description: "Удаляет заметку. Подтвердите удаление у пользователя; действие можно отменить в журнале.",
    scopes: ["notes:write"],
    kind: "destructive",
    input: { id: z.string().describe("id заметки") },
    run: async ({ id }) =>
      await write(ctx, async (tx) => {
        const before = must(await snapshotEntity(tx, "note", id), "Заметка");
        await deleteNote(tx, id);
        await log(tx, ctx, "delete_note", "note", id, "delete", `Удалена заметка ${label({ title: String(before.title), kind: "" })}`, before);
        return { deleted: { id, title: before.title } };
      }),
  });
}
