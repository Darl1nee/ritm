import clsx from "clsx";
import { Lightbulb, Pin } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import type { Note, Project } from "@/lib/queries";
import { AgentBadge, isAgentSource } from "@/components/ui/AgentBadge";
import { stripMarkdown } from "./markdown";

interface NoteCardProps {
  note: Note;
  project?: Project;
  onOpen: (id: string) => void;
}

export function NoteCard({ note, project, onOpen }: NoteCardProps) {
  const preview = stripMarkdown(note.body);
  return (
    <button
      type="button"
      onClick={() => onOpen(note.id)}
      className="group flex min-h-[176px] w-full flex-col gap-2 rounded-card bg-surface p-5 text-left shadow-card transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-pop"
    >
      <div className="flex items-start gap-2">
        <h3 className={clsx("line-clamp-2 min-w-0 flex-1 text-[15px] font-semibold leading-snug", !note.title && "text-fg-sub")}>
          {note.title || "Без названия"}
        </h3>
        {isAgentSource(note) && <AgentBadge className="mt-0.5" />}
        {note.pinned && <Pin size={15} className="mt-0.5 shrink-0 fill-accent text-accent" aria-label="Закреплена" />}
      </div>
      <p className="line-clamp-5 flex-1 whitespace-pre-line break-words text-[13px] leading-5 text-fg-sub">
        {preview || "Пустая заметка"}
      </p>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-fg-sub">
        <span className="tabular-nums">{format(parseISO(note.updated_at), "d MMM, HH:mm", { locale: ru }).replace(".", "")}</span>
        <span className="flex min-w-0 items-center gap-2">
          {note.kind === "idea" && <Lightbulb size={13} aria-label="Идея" />}
          {project && (
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5">
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: project.color }} />
              <span className="truncate">{project.title}</span>
            </span>
          )}
        </span>
      </div>
    </button>
  );
}
