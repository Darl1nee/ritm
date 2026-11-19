"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Eye, Pencil, Pin, Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/projects/ConfirmModal";
import { useDeleteNote, useNote, useProjects, useUpdateNote, type Note } from "@/lib/queries";
import { Markdown } from "./markdown";

type SaveState = "idle" | "saving" | "saved" | "error";

interface NoteEditorSheetProps {
  noteId: string | null;
  onClose: () => void;
}

/** Редактор заметки в боковой панели. Открывается по noteId (URL ?note=). */
export function NoteEditorSheet({ noteId, onClose }: NoteEditorSheetProps) {
  const { data: note, error } = useNote(noteId);
  const toast = useToast();
  const del = useDeleteNote();

  // Если заметки нет (старая ссылка) — закрываем с тостом.
  const hadNote = useRef(false);
  if (note) hadNote.current = true;
  useEffect(() => {
    if (noteId && error && !hadNote.current) {
      toast.error("Заметка не найдена");
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, noteId]);

  if (!noteId) return null;
  return (
    <>
      {note ? (
        <EditorBody key={note.id} note={note} onClose={onClose} onDelete={() => del.mutate(note.id, { onSuccess: onClose })} />
      ) : (
        <Sheet open onClose={onClose} width={640}>
          <div className="flex flex-col gap-4 pt-2">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        </Sheet>
      )}
    </>
  );
}

function EditorBody({ note, onClose, onDelete }: { note: Note; onClose: () => void; onDelete: () => void }) {
  const update = useUpdateNote();
  const { data: projects } = useProjects();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [kind, setKind] = useState(note.kind);
  const [pinned, setPinned] = useState(note.pinned);
  const [projectId, setProjectId] = useState<string>(note.project_id ?? "");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [state, setState] = useState<SaveState>("idle");
  const [confirmDel, setConfirmDel] = useState(false);

  // Последнее сохранённое/ожидающее значение текста — для flush при закрытии.
  const saved = useRef({ title: note.title, body: note.body });
  const latest = useRef({ title, body });
  latest.current = { title, body };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const save = useCallback(
    (patch: { title?: string; body?: string; kind?: Note["kind"]; pinned?: boolean; project_id?: string | null }) => {
      setState("saving");
      update.mutate(
        { id: note.id, ...patch },
        {
          onSuccess: () => setState("saved"),
          onError: () => setState("error"),
        },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [note.id],
  );

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const { title: t, body: b } = latest.current;
    if (t !== saved.current.title || b !== saved.current.body) {
      saved.current = { title: t, body: b };
      save({ title: t, body: b });
    }
  }, [save]);

  // Автосохранение текста с debounce 600мс.
  useEffect(() => {
    if (title === saved.current.title && body === saved.current.body) return;
    timer.current = setTimeout(flush, 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [title, body, flush]);

  // Сохранить несохранённое при уходе со страницы / размонтировании.
  useEffect(() => () => flush(), [flush]);

  // Автоувеличение высоты текста.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 200)}px`;
  }, [body, mode]);

  const close = () => {
    // Пустую заметку (создали и ничего не написали) не оставляем.
    if (!latest.current.title.trim() && !latest.current.body.trim()) {
      if (timer.current) clearTimeout(timer.current);
      saved.current = { ...latest.current };
      onDelete();
      return;
    }
    flush();
    onClose();
  };

  const toggleLine = (line: number) => {
    const lines = body.split("\n");
    lines[line] = lines[line].replace(/\[( |x|X)\]/, (_m, c: string) => (c === " " ? "[x]" : "[ ]"));
    setBody(lines.join("\n"));
  };

  const status =
    state === "saving" ? "Сохранение…" : state === "saved" ? "Сохранено" : state === "error" ? "Не удалось сохранить" : "";

  return (
    <>
      <Sheet
        open
        onClose={close}
        width={640}
        title={
          <span className={clsx("text-[13px] font-medium", state === "error" ? "text-danger" : "text-fg-sub")} aria-live="polite">
            {status || "Заметка"}
          </span>
        }
        actions={
          <>
            <IconButton
              label={pinned ? "Открепить" : "Закрепить"}
              size="sm"
              active={pinned}
              onClick={() => {
                setPinned(!pinned);
                save({ pinned: !pinned });
              }}
            >
              <Pin className={pinned ? "fill-current" : ""} />
            </IconButton>
            <IconButton label="Удалить заметку" size="sm" variant="danger" onClick={() => setConfirmDel(true)}>
              <Trash2 />
            </IconButton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <input
            autoFocus={!note.title && !note.body}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Без названия"
            aria-label="Заголовок"
            className="w-full bg-transparent text-[28px] font-bold leading-tight tracking-[-0.01em] outline-none placeholder:text-fg-sub/60"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              size="sm"
              aria-label="Тип"
              value={kind}
              onChange={(v) => {
                setKind(v);
                save({ kind: v });
              }}
              options={[
                { value: "note", label: "Заметка" },
                { value: "idea", label: "Идея" },
              ]}
            />
            <Segmented
              size="sm"
              aria-label="Режим"
              value={mode}
              onChange={setMode}
              options={[
                { value: "edit", label: "Редактировать", icon: <Pencil /> },
                { value: "preview", label: "Просмотр", icon: <Eye /> },
              ]}
            />
            <Select
              aria-label="Проект"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                save({ project_id: e.target.value || null });
              }}
              className="min-w-[160px] flex-1 sm:max-w-[220px]"
            >
              <option value="">Без проекта</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.emoji ? `${p.emoji} ` : ""}
                  {p.title}
                </option>
              ))}
            </Select>
          </div>
          {mode === "edit" ? (
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Пишите здесь. Поддерживается markdown: # заголовок, - список, - [ ] задача, **жирный**"
              aria-label="Текст заметки"
              className="min-h-[200px] w-full resize-none overflow-hidden bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-fg-sub/60"
            />
          ) : (
            <Markdown text={body} onToggleLine={toggleLine} className="min-h-[200px]" />
          )}
        </div>
      </Sheet>
      <ConfirmModal
        open={confirmDel}
        title="Удалить заметку?"
        text="Заметка будет удалена без возможности восстановления."
        onConfirm={() => {
          setConfirmDel(false);
          // Сначала сбрасываем таймер, чтобы автосохранение не писало в удалённую заметку.
          if (timer.current) clearTimeout(timer.current);
          saved.current = { ...latest.current };
          onDelete();
        }}
        onClose={() => setConfirmDel(false)}
      />
    </>
  );
}
