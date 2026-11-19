"use client";
import { useState } from "react";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToggleTask, type ProjectDetail, type Task } from "@/lib/queries";
import { AddTaskInline } from "./AddTaskInline";
import { TaskMeta } from "./TaskMeta";

export function ListView({ project, onOpenTask }: { project: ProjectDetail; onOpenTask: (t: Task) => void }) {
  const top = project.tasks.filter((t) => t.parent_id === null);
  const sectionIds = new Set(project.sections.map((s) => s.id));
  const groups = project.sections.map((s) => ({ id: s.id, title: s.title, tasks: top.filter((t) => t.section_id === s.id) }));
  const loose = top.filter((t) => !t.section_id || !sectionIds.has(t.section_id));
  if (loose.length) groups.unshift({ id: "__none", title: "Без раздела", tasks: loose });

  if (groups.length === 0) return <EmptyState text="В проекте пока нет разделов" />;
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <Group key={g.id} projectId={project.id} color={project.color} group={g} onOpenTask={onOpenTask} />
      ))}
    </div>
  );
}

function Group({
  projectId,
  color,
  group,
  onOpenTask,
}: {
  projectId: string;
  color: string;
  group: { id: string; title: string; tasks: Task[] };
  onOpenTask: (t: Task) => void;
}) {
  const [showDone, setShowDone] = useState(false);
  const open = group.tasks.filter((t) => !t.done);
  const done = group.tasks.filter((t) => t.done);
  return (
    <section aria-label={group.title} className="rounded-card bg-surface p-4 shadow-card md:p-5">
      <h3 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold">
        <span className="size-2.5 rounded-full" style={{ background: color }} />
        {group.title}
        <span className="text-xs font-normal tabular-nums text-fg-sub">{open.length}</span>
      </h3>
      <div className="flex flex-col">
        {open.map((t) => (
          <Row key={t.id} task={t} color={color} onOpen={onOpenTask} />
        ))}
        {open.length === 0 && done.length === 0 && <p className="px-2 py-2 text-[13px] text-fg-sub">Пока пусто</p>}
        {done.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              aria-expanded={showDone}
              className="mt-1 flex h-8 items-center gap-1.5 rounded-xl px-2 text-xs text-fg-sub transition-colors hover:text-fg"
            >
              <ChevronRight size={14} className={clsx("transition-transform duration-150", showDone && "rotate-90")} />
              Выполнено · {done.length}
            </button>
            {showDone && done.map((t) => <Row key={t.id} task={t} color={color} onOpen={onOpenTask} />)}
          </>
        )}
      </div>
      <div className="mt-1">
        <AddTaskInline projectId={projectId} sectionId={group.id === "__none" ? null : group.id} />
      </div>
    </section>
  );
}

function Row({ task, color, onOpen }: { task: Task; color: string; onOpen: (t: Task) => void }) {
  const toggle = useToggleTask();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(task)}
      className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-150 hover:bg-surface-2"
    >
      <Checkbox checked={task.done} color={color} size={20} aria-label={task.done ? "Вернуть в работу" : "Выполнить"} onChange={() => toggle.mutate(task.id)} />
      <span className="strike min-w-0 flex-1 break-words text-sm" data-done={task.done}>
        {task.title}
      </span>
      <TaskMeta task={task} className="shrink-0 flex-nowrap" />
    </div>
  );
}
