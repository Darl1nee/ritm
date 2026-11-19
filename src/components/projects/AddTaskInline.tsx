"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useCreateTask } from "@/lib/queries";

interface AddTaskInlineProps {
  projectId: string;
  /** null — задача без секции. */
  sectionId: string | null;
}

/** «+ Задача»: Enter создаёт и оставляет поле для следующей, Esc/пусто+blur — закрывает. */
export function AddTaskInline({ projectId, sectionId }: AddTaskInlineProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const create = useCreateTask();

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    setTitle("");
    create.mutate({ title: t, project_id: projectId, section_id: sectionId });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center gap-2 rounded-xl px-2.5 text-[13px] text-fg-sub transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
      >
        <Plus size={15} />
        Задача
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") {
          setTitle("");
          setOpen(false);
        }
      }}
      onBlur={() => {
        submit();
        setOpen(false);
      }}
      placeholder="Название задачи, Enter"
      aria-label="Новая задача"
      className="h-10 w-full rounded-xl bg-surface-2 px-3 text-sm outline-none ring-2 ring-accent/40 placeholder:text-fg-sub"
    />
  );
}
