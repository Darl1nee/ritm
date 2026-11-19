"use client";
import { useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { NoteEditorSheet } from "@/components/notes/NoteEditor";
import { ApiError } from "@/lib/api";
import { useProject, type Task } from "@/lib/queries";
import { Board } from "./Board";
import { ListView } from "./ListView";
import { ProjectHeader } from "./ProjectHeader";
import { ProjectNotes } from "./ProjectNotes";
import { TaskSheet } from "@/components/tasks/TaskSheet";
import { useUrlParams } from "./url-state";

type View = "board" | "list" | "notes";
const VIEWS: View[] = ["board", "list", "notes"];

export function ProjectView({ id }: { id: string }) {
  const { data: project, isLoading, error } = useProject(id);
  const { sp, set } = useUrlParams();
  const raw = sp.get("view");
  const view: View = VIEWS.includes(raw as View) ? (raw as View) : "board";
  const noteId = sp.get("note");

  const [editingId, setEditingId] = useState<string | null>(null);
  const openTask = (t: Task) => setEditingId(t.id);

  if (isLoading)
    return (
      <div className="flex flex-col gap-4 pt-8">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-14 w-2/3" />
        <Skeleton className="h-3 w-full max-w-2xl" />
        <div className="mt-4 flex gap-4 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 w-[284px] shrink-0 rounded-card" />
          ))}
        </div>
      </div>
    );
  if (error || !project)
    return (
      <div className="pt-10">
        <EmptyState text={error instanceof ApiError && error.status === 404 ? "Проект не найден" : "Не удалось загрузить проект"} />
      </div>
    );

  return (
    <div className="min-w-0 max-w-full">
      <ProjectHeader project={project} />
      <Segmented<View>
        aria-label="Вид проекта"
        className="mb-5"
        value={view}
        onChange={(v) => set({ view: v === "board" ? null : v })}
        options={[
          { value: "board", label: "Доска" },
          { value: "list", label: "Список" },
          { value: "notes", label: "Заметки" },
        ]}
      />
      {view === "board" && <Board project={project} onOpenTask={openTask} />}
      {view === "list" && <ListView project={project} onOpenTask={openTask} />}
      {view === "notes" && <ProjectNotes project={project} onOpen={(n) => set({ note: n })} />}

      <TaskSheet taskId={editingId} onClose={() => setEditingId(null)} />
      <NoteEditorSheet noteId={noteId} onClose={() => set({ note: null })} />
    </div>
  );
}
