"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { ListChecks, MoreHorizontal, Play, Trash2, CalendarDays, CalendarRange, Archive } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { IconButton } from "@/components/ui/IconButton";
import { AgentBadge, isAgentSource } from "@/components/ui/AgentBadge";
import { Menu } from "@/components/ui/Menu";
import { useToast } from "@/components/ui/Toast";
import { useFocusTimer } from "@/components/shell";
import {
  useCategories,
  useDeleteTask,
  useProjects,
  useToggleTask,
  useUpdateTask,
  type Task,
} from "@/lib/queries";
import { PRIORITY_COLORS, bucketPatch, relativeDate } from "./task-utils";

export interface TaskItemProps {
  task: Task;
  /** Клик по строке (кроме чекбокса и кнопок) — обычно открыть TaskSheet. */
  onOpen?: (id: string) => void;
  /** Плотная строка (для карточек Обзора). */
  compact?: boolean;
  /** Скрыть кнопки «в фокус» и меню. */
  hideActions?: boolean;
  /** Скрыть название проекта в мете (когда список уже внутри проекта). */
  hideProject?: boolean;
  /** Для dnd-kit: ref корневого элемента, стили трансформации и слушатели. */
  innerRef?: React.Ref<HTMLDivElement>;
  style?: React.CSSProperties;
  dragProps?: React.HTMLAttributes<HTMLDivElement>;
  dragging?: boolean;
  className?: string;
}

/** Строка задачи: чекбокс, название, мета, быстрые действия по hover. */
export function TaskItem({
  task,
  onOpen,
  compact,
  hideActions,
  hideProject,
  innerRef,
  style,
  dragProps,
  dragging,
  className,
}: TaskItemProps) {
  const toast = useToast();
  const timer = useFocusTimer();
  const toggle = useToggleTask();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const { data: categories } = useCategories();
  const { data: projects } = useProjects();

  // Локальная оптимистичность: работает и там, где список приходит не из кэша задач (Обзор).
  const [pending, setPending] = useState<boolean | null>(null);
  useEffect(() => setPending(null), [task.done]);
  const done = pending ?? task.done;

  const category = categories?.find((c) => c.id === task.category_id);
  const project = projects?.find((p) => p.id === task.project_id);
  const checkColor = task.priority > 0 ? PRIORITY_COLORS[task.priority] : category?.color;

  const meta: React.ReactNode[] = [];
  if (task.due_date) {
    meta.push(
      <span key="date" className={clsx(task.overdue && !done && "font-medium text-danger")}>
        {relativeDate(task.due_date)}
      </span>,
    );
  }
  if (task.due_time) meta.push(<span key="time">{task.due_time}</span>);
  if (category) {
    meta.push(
      <span key="cat" className="inline-flex items-center gap-1.5">
        <span className="size-1.5 rounded-full" style={{ background: category.color }} />
        {category.name}
      </span>,
    );
  }
  if (project && !hideProject) {
    meta.push(
      <span key="proj" className="inline-flex min-w-0 items-center gap-1">
        {project.emoji && <span>{project.emoji}</span>}
        <span className="truncate">{project.title}</span>
      </span>,
    );
  }
  if (task.subtasks_total > 0) {
    meta.push(
      <span key="sub" className="inline-flex items-center gap-1 tabular-nums">
        <ListChecks size={12} />
        {task.subtasks_done}/{task.subtasks_total}
      </span>,
    );
  }

  if (isAgentSource(task)) meta.push(<AgentBadge key="agent" size={12} />);

  return (
    <div
      ref={innerRef}
      style={style}
      {...dragProps}
      onClick={() => onOpen?.(task.id)}
      className={clsx(
        "group relative flex items-center gap-3 rounded-2xl px-2.5 transition-colors duration-150 ease-out hover:bg-surface-2",
        compact ? "py-1.5" : "py-2.5",
        onOpen && "cursor-pointer",
        dragging && "z-10 bg-surface shadow-pop ring-1 ring-line",
        className,
      )}
    >
      <Checkbox
        checked={done}
        color={checkColor}
        aria-label={done ? "Вернуть в работу" : "Выполнить"}
        onChange={(checked) => {
          setPending(checked);
          toggle.mutate(task.id, { onError: () => setPending(null) });
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] leading-snug">
          <span className="strike" data-done={done}>
            {task.title}
          </span>
        </div>
        {meta.length > 0 && (
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] leading-tight text-fg-sub">
            {meta}
          </div>
        )}
      </div>
      {!hideActions && (
        <div
          className="flex shrink-0 items-center gap-0.5 md:opacity-0 md:transition-opacity md:duration-150 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <IconButton
            label="В фокус"
            size="sm"
            className="hidden md:inline-flex"
            disabled={timer.status !== "idle" || done}
            onClick={() => timer.start({ taskId: task.id })}
          >
            <Play />
          </IconButton>
          <Menu
            align="end"
            trigger={
              <IconButton label="Действия" size="sm">
                <MoreHorizontal />
              </IconButton>
            }
            items={[
              { label: "Сегодня", icon: <CalendarDays />, onSelect: () => update.mutate({ id: task.id, ...bucketPatch(task, "today") }) },
              { label: "На неделе", icon: <CalendarRange />, onSelect: () => update.mutate({ id: task.id, ...bucketPatch(task, "week") }) },
              { label: "Потом", icon: <Archive />, onSelect: () => update.mutate({ id: task.id, ...bucketPatch(task, "later") }) },
              "divider",
              {
                label: "Удалить",
                icon: <Trash2 />,
                danger: true,
                onSelect: () => del.mutate(task.id, { onSuccess: () => toast.success("Задача удалена") }),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
