"use client";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCreateTask, type Task } from "@/lib/queries";
import { TaskItem } from "./TaskItem";
import { GROUP_META, type GroupKey } from "./task-utils";

function SortableTask({ task, onOpen }: { task: Task; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <TaskItem
      task={task}
      onOpen={onOpen}
      innerRef={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      dragProps={{ ...attributes, ...listeners }}
    />
  );
}

/** Инлайн-добавление: кнопка превращается в поле; Enter создаёт, Esc отменяет. */
function InlineAdd({ group, categoryId }: { group: GroupKey; categoryId: string | null }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const create = useCreateTask();

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  const submit = () => {
    const title = value.trim();
    if (!title) return;
    create.mutate({ title, bucket: group, category_id: categoryId });
    setValue("");
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full items-center gap-3 rounded-2xl px-2.5 text-sm text-fg-sub transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
      >
        <Plus size={18} className="mx-0.5" />
        Добавить
      </button>
    );
  }
  return (
    <div className="anim-fade flex h-10 items-center gap-3 rounded-2xl bg-surface-2 px-2.5">
      <Plus size={18} className="mx-0.5 shrink-0 text-accent" />
      <input
        ref={ref}
        value={value}
        placeholder="Название задачи, Enter — добавить"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            setValue("");
            setOpen(false);
          }
        }}
        onBlur={() => {
          if (!value.trim()) setOpen(false);
        }}
        className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-sub"
      />
    </div>
  );
}

interface TaskGroupProps {
  group: GroupKey;
  /** Упорядоченные задачи группы. */
  tasks: Task[];
  categoryId: string | null;
  onOpen: (id: string) => void;
}

export function TaskGroup({ group, tasks, categoryId, onOpen }: TaskGroupProps) {
  const meta = GROUP_META[group];
  const { setNodeRef, isOver } = useDroppable({ id: group });
  return (
    <section className="rounded-card bg-surface p-3 shadow-card md:p-4">
      <header className="flex items-center gap-2.5 px-2.5 pb-2 pt-1">
        <span className="size-2.5 rounded-full" style={{ background: meta.color }} />
        <h2 className="text-[15px] font-semibold">{meta.title}</h2>
        <span className="ml-auto text-[13px] tabular-nums text-fg-sub">{tasks.length}</span>
      </header>
      <div
        ref={setNodeRef}
        className={clsx("rounded-2xl transition-colors duration-150", isOver && tasks.length === 0 && "bg-accent-soft")}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <EmptyState compact text={meta.empty} className="my-1 rounded-2xl" />
          ) : (
            tasks.map((t) => <SortableTask key={t.id} task={t} onOpen={onOpen} />)
          )}
        </SortableContext>
      </div>
      <InlineAdd group={group} categoryId={categoryId} />
    </section>
  );
}
