import clsx from "clsx";
import { CalendarDays, ListChecks } from "lucide-react";
import type { Task } from "@/lib/queries";
import { shortDate } from "./utils";

/** Дата и счётчик подзадач — общий для карточки доски и строки списка. */
export function TaskMeta({ task, className }: { task: Task; className?: string }) {
  const has = task.due_date || task.subtasks_total > 0;
  if (!has) return null;
  return (
    <div className={clsx("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-fg-sub", className)}>
      {task.due_date && (
        <span className={clsx("inline-flex items-center gap-1", task.overdue && "font-medium text-danger")}>
          <CalendarDays size={12} />
          {shortDate(task.due_date)}
          {task.due_time ? `, ${task.due_time}` : ""}
        </span>
      )}
      {task.subtasks_total > 0 && (
        <span className="inline-flex items-center gap-1">
          <ListChecks size={12} />
          {task.subtasks_done}/{task.subtasks_total}
        </span>
      )}
    </div>
  );
}
