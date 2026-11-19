"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Menu } from "@/components/ui/Menu";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  useCreateSection,
  useDeleteSection,
  useReorderTasks,
  useToggleTask,
  useUpdateSection,
  type ProjectDetail,
  type Section,
  type Task,
} from "@/lib/queries";
import { AddTaskInline } from "./AddTaskInline";
import { ConfirmModal } from "./ConfirmModal";
import { AgentBadge, isAgentSource } from "@/components/ui/AgentBadge";
import { TaskMeta } from "./TaskMeta";
import { COLUMN_WORDS } from "./types";

const NONE = "__none";

interface Column {
  id: string;
  title: string;
  section: Section | null;
}

interface BoardProps {
  project: ProjectDetail;
  onOpenTask: (task: Task) => void;
}

export function Board({ project, onOpenTask }: BoardProps) {
  const reorder = useReorderTasks();
  const top = useMemo(() => project.tasks.filter((t) => t.parent_id === null), [project.tasks]);
  const taskById = useMemo(() => new Map(top.map((t) => [t.id, t])), [top]);

  const hasUnsectioned = top.some((t) => !t.section_id || !project.sections.some((s) => s.id === t.section_id));
  const columns: Column[] = useMemo(() => {
    const cols: Column[] = project.sections.map((s) => ({ id: s.id, title: s.title, section: s }));
    if (hasUnsectioned) cols.unshift({ id: NONE, title: "Без раздела", section: null });
    return cols;
  }, [project.sections, hasUnsectioned]);

  const serverItems = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const c of columns) m[c.id] = [];
    for (const t of top) {
      const col = t.section_id && m[t.section_id] ? t.section_id : NONE;
      (m[col] ??= []).push(t.id);
    }
    return m;
  }, [columns, top]);

  const [items, setItems] = useState(serverItems);
  const [activeId, setActiveId] = useState<string | null>(null);
  const snapshot = useRef<Record<string, string[]> | null>(null);
  useEffect(() => {
    if (!activeId) setItems(serverItems);
  }, [serverItems, activeId]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  const findContainer = (id: string, map = items): string | undefined =>
    id in map ? id : Object.keys(map).find((k) => map[k].includes(id));

  const onDragStart = (e: DragStartEvent) => {
    snapshot.current = Object.fromEntries(Object.entries(items).map(([k, v]) => [k, [...v]]));
    setActiveId(String(e.active.id));
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const aId = String(active.id);
    const oId = String(over.id);
    const from = findContainer(aId);
    const to = findContainer(oId);
    if (!from || !to || from === to) return;
    setItems((prev) => {
      const src = prev[from].filter((i) => i !== aId);
      const dst = [...prev[to]];
      const overIndex = dst.indexOf(oId);
      let index = dst.length;
      if (overIndex >= 0) {
        const activeRect = active.rect.current.translated;
        const below = !!activeRect && activeRect.top > over.rect.top + over.rect.height / 2;
        index = overIndex + (below ? 1 : 0);
      }
      dst.splice(index, 0, aId);
      return { ...prev, [from]: src, [to]: dst };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const aId = String(active.id);
    let next = items;
    if (over) {
      const container = findContainer(aId);
      const overContainer = findContainer(String(over.id));
      if (container && overContainer && container === overContainer) {
        const oldIndex = items[container].indexOf(aId);
        const newIndex = items[container].indexOf(String(over.id));
        if (newIndex >= 0 && oldIndex !== newIndex) {
          next = { ...items, [container]: arrayMove(items[container], oldIndex, newIndex) };
          setItems(next);
        }
      }
    }
    const before = snapshot.current;
    snapshot.current = null;
    setActiveId(null);
    if (!before) return;
    const payload: { id: string; sort: number; section_id: string | null }[] = [];
    for (const colId of Object.keys(next)) {
      if (JSON.stringify(next[colId]) === JSON.stringify(before[colId])) continue;
      next[colId].forEach((id, i) => payload.push({ id, sort: i, section_id: colId === NONE ? null : colId }));
    }
    if (payload.length) reorder.mutate(payload);
    else setItems(serverItems);
  };

  const onDragCancel = () => {
    if (snapshot.current) setItems(snapshot.current);
    snapshot.current = null;
    setActiveId(null);
  };

  const active = activeId ? taskById.get(activeId) : null;
  const words = COLUMN_WORDS[project.type];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="no-scrollbar -mx-1 flex max-w-full items-start gap-4 overflow-x-auto px-1 pb-6">
        {columns.map((c) => (
          <BoardColumn
            key={c.id}
            column={c}
            project={project}
            ids={items[c.id] ?? []}
            taskById={taskById}
            onOpenTask={onOpenTask}
          />
        ))}
        <AddColumn projectId={project.id} label={words.add} placeholder={words.newTitle} />
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
        {active ? <CardBody task={active} color={project.color} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumn({
  column,
  project,
  ids,
  taskById,
  onOpenTask,
}: {
  column: Column;
  project: ProjectDetail;
  ids: string[];
  taskById: Map<string, Task>;
  onOpenTask: (t: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const updateSection = useUpdateSection();
  const delSection = useDeleteSection();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(column.title);
  const [confirm, setConfirm] = useState(false);
  const words = COLUMN_WORDS[project.type];
  const tasks = ids.map((id) => taskById.get(id)).filter((t): t is Task => !!t);
  const done = tasks.filter((t) => t.done).length;
  const learning = project.type === "learning";

  const commitName = () => {
    setRenaming(false);
    const t = name.trim();
    if (t && t !== column.title && column.section) updateSection.mutate({ id: column.section.id, title: t });
    else setName(column.title);
  };
  const startRename = () => {
    if (!column.section) return;
    setName(column.title);
    setRenaming(true);
  };

  return (
    <section
      aria-label={column.title}
      className={clsx(
        "flex w-[284px] shrink-0 flex-col gap-3 rounded-card bg-surface-2/60 p-3 transition-colors duration-150",
        isOver && "bg-accent-soft",
      )}
    >
      <header className="flex flex-col gap-2 px-1.5 pt-1">
        <div className="flex items-center gap-2">
          {renaming ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") {
                  setName(column.title);
                  setRenaming(false);
                }
              }}
              aria-label="Название колонки"
              className="h-8 min-w-0 flex-1 rounded-lg bg-surface px-2 text-sm font-semibold outline-none ring-2 ring-accent/40"
            />
          ) : (
            <h3
              onDoubleClick={startRename}
              title={column.section ? "Двойной клик — переименовать" : undefined}
              className="min-w-0 flex-1 cursor-default select-none truncate text-sm font-semibold"
            >
              {column.title}
            </h3>
          )}
          <span className="rounded-full bg-surface px-2 py-0.5 text-xs tabular-nums text-fg-sub">{tasks.length}</span>
          {column.section && (
            <Menu
              align="end"
              trigger={
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Меню колонки"
                  className="inline-flex size-7 items-center justify-center rounded-full text-fg-sub transition-colors hover:bg-surface hover:text-fg"
                >
                  <MoreHorizontal size={16} />
                </span>
              }
              items={[
                { label: words.rename, icon: <Pencil />, onSelect: startRename },
                "divider",
                { label: "Удалить", icon: <Trash2 />, danger: true, onSelect: () => setConfirm(true) },
              ]}
            />
          )}
        </div>
        {learning && tasks.length > 0 && (
          <div className="flex items-center gap-2 text-[11px] tabular-nums text-fg-sub">
            <ProgressBar value={(done / tasks.length) * 100} color={project.color} height={4} />
            <span className="shrink-0">
              {done}/{tasks.length}
            </span>
          </div>
        )}
      </header>

      <div ref={setNodeRef} className="flex min-h-[44px] flex-col gap-2">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableCard key={t.id} task={t} color={project.color} onOpen={onOpenTask} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <p className="rounded-2xl border-[1.5px] border-dashed border-line px-3 py-4 text-center text-xs text-fg-sub">{words.empty}</p>
        )}
      </div>

      <AddTaskInline projectId={project.id} sectionId={column.section?.id ?? null} />

      <ConfirmModal
        open={confirm}
        title={`Удалить «${column.title}»?`}
        text="Задачи из этой колонки не удаляются, они переедут в «Без раздела»."
        loading={delSection.isPending}
        onConfirm={() => {
          if (column.section) delSection.mutate(column.section.id, { onSuccess: () => setConfirm(false) });
        }}
        onClose={() => setConfirm(false)}
      />
    </section>
  );
}

function SortableCard({ task, color, onOpen }: { task: Task; color: string; onOpen: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter") onOpen(task);
      }}
    >
      <CardBody task={task} color={color} />
    </div>
  );
}

function CardBody({ task, color, overlay }: { task: Task; color: string; overlay?: boolean }) {
  const toggle = useToggleTask();
  return (
    <div
      className={clsx(
        "flex cursor-pointer items-start gap-3 rounded-2xl bg-surface p-3 shadow-card transition-shadow duration-150 hover:shadow-pop",
        overlay && "rotate-[1.5deg] shadow-pop",
      )}
    >
      <Checkbox
        checked={task.done}
        color={color}
        size={20}
        aria-label={task.done ? "Вернуть в работу" : "Выполнить"}
        onChange={() => toggle.mutate(task.id)}
        className="mt-px"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="strike break-words text-sm leading-snug" data-done={task.done}>
          {task.title}
          {isAgentSource(task) && <AgentBadge size={12} className="ml-1.5 align-[-1px]" />}
        </span>
        <TaskMeta task={task} />
      </div>
    </div>
  );
}

function AddColumn({ projectId, label, placeholder }: { projectId: string; label: string; placeholder: string }) {
  const create = useCreateSection();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const submit = () => {
    const t = title.trim();
    setOpen(false);
    setTitle("");
    if (t) create.mutate({ projectId, title: t });
  };
  return (
    <div className="w-[284px] shrink-0">
      {open ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={submit}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") {
              setTitle("");
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-11 w-full rounded-card bg-surface-2 px-4 text-sm font-medium outline-none ring-2 ring-accent/40 placeholder:text-fg-sub"
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-line text-sm text-fg-sub transition-colors duration-150 hover:border-accent/50 hover:text-accent"
        >
          <Plus size={16} />
          {label}
        </button>
      )}
    </div>
  );
}
