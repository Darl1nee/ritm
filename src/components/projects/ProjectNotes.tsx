"use client";
import { Plus } from "lucide-react";
import { NoteCard } from "@/components/notes/NoteCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCreateNote, useNotes, type Project } from "@/lib/queries";

interface ProjectNotesProps {
  project: Project;
  onOpen: (id: string) => void;
}

export function ProjectNotes({ project, onOpen }: ProjectNotesProps) {
  const { data, isLoading } = useNotes({ project_id: project.id });
  const create = useCreateNote();
  const add = () => create.mutate({ project_id: project.id, title: "", body: "" }, { onSuccess: (n) => onOpen(n.id) });

  if (isLoading)
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-44 rounded-card" />
        ))}
      </div>
    );
  if (!data || data.length === 0) return <EmptyState text="Заметок проекта пока нет — создайте первую" onClick={add} />;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button icon={<Plus />} onClick={add} disabled={create.isPending}>
          Новая заметка
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {data.map((n) => (
          <NoteCard key={n.id} note={n} project={project} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}
