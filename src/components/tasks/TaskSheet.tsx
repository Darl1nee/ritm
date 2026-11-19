"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DateInput } from "@/components/ui/DateInput";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { TimeInput } from "@/components/ui/TimeInput";
import { useToast } from "@/components/ui/Toast";
import {
  useCategories,
  useCreateTask,
  useDeleteTask,
  useGoals,
  useProjects,
  useTask,
  useToggleTask,
  useUpdateTask,
  type TaskWithSubtasks,
} from "@/lib/queries";
import type { TaskUpdate } from "@/shared/schemas";
import { PRIORITY_LABELS } from "@/lib/ui-constants";
import { bucketPatch } from "./task-utils";

interface TaskSheetProps {
  taskId: string | null;
  onClose: () => void;
}

/** Боковая панель редактирования задачи. Управляется снаружи: taskId=null — закрыта. */
export function TaskSheet({ taskId, onClose }: TaskSheetProps) {
  const { data: task, isError } = useTask(taskId);
  return (
    <Sheet open={!!taskId} onClose={onClose} title="Задача" width={480}>
      {task && task.id === taskId ? (
        <TaskForm key={task.id} task={task} onClose={onClose} />
      ) : isError ? (
        <p className="py-10 text-center text-sm text-fg-sub">Задача не найдена</p>
      ) : (
        <div className="flex flex-col gap-4 pt-2">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}
    </Sheet>
  );
}

const DURATIONS = [15, 25, 30, 45, 60, 90, 120];

function TaskForm({ task, onClose }: { task: TaskWithSubtasks; onClose: () => void }) {
  const toast = useToast();
  const update = useUpdateTask();
  const toggle = useToggleTask();
  const create = useCreateTask();
  const del = useDeleteTask();
  const { data: categories } = useCategories();
  const { data: projects } = useProjects();
  const { data: goals } = useGoals();

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [duration, setDuration] = useState(task.duration_min ? String(task.duration_min) : "");
  const [newSub, setNewSub] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [done, setDone] = useState(task.done);
  // Локальные значения быстро меняемых полей, чтобы контролы не «отскакивали» до ответа сервера.
  const [local, setLocal] = useState({
    bucket: task.bucket,
    due_date: task.due_date ?? "",
    due_time: task.due_time ?? "",
    priority: task.priority,
    category_id: task.category_id,
    project_id: task.project_id,
    goal_id: task.goal_id,
  });
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDone(task.done), [task.done]);

  const save = (patch: TaskUpdate) =>
    update.mutate({ id: task.id, ...patch }, { onError: () => toast.error("Не удалось сохранить") });

  const commitTitle = () => {
    const t = title.trim();
    if (!t) return setTitle(task.title);
    if (t !== task.title) save({ title: t });
  };
  const commitNotes = () => {
    if (notes !== task.notes) save({ notes });
  };
  const commitDuration = () => {
    const n = parseInt(duration, 10);
    const next = Number.isFinite(n) && n > 0 ? n : null;
    if (next !== task.duration_min) save({ duration_min: next });
    if (next === null) setDuration("");
  };
  const addSub = () => {
    const t = newSub.trim();
    if (!t) return;
    create.mutate({ title: t, parent_id: task.id, bucket: task.bucket });
    setNewSub("");
  };

  const activeProjects = (projects ?? []).filter((p) => p.status === "active" || p.id === local.project_id);
  const activeGoals = (goals ?? []).filter((g) => g.status === "active" || g.id === local.goal_id);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={done}
          size={26}
          className="mt-1.5"
          aria-label={done ? "Вернуть в работу" : "Выполнить"}
          onChange={(c) => {
            setDone(c);
            toggle.mutate(task.id, { onError: () => setDone(!c) });
          }}
        />
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") titleRef.current?.blur();
          }}
          aria-label="Название задачи"
          className="min-w-0 flex-1 rounded-xl bg-transparent px-1 py-1 text-[22px] font-semibold leading-tight outline-none transition-colors focus:bg-surface-2"
        />
      </div>

      <Field label="Заметки">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={commitNotes}
          rows={4}
          placeholder="Детали, ссылки, мысли…"
        />
      </Field>

      <Field label="Когда">
        <Segmented
          fullWidth
          value={local.bucket}
          onChange={(bucket) => {
            const patch = bucketPatch(task, bucket);
            setLocal((l) => ({ ...l, bucket, due_date: patch.due_date === null ? "" : l.due_date }));
            save(patch);
          }}
          options={[
            { value: "inbox", label: "Входящие" },
            { value: "today", label: "Сегодня" },
            { value: "week", label: "Неделя" },
            { value: "later", label: "Потом" },
          ]}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Дата">
          <div className="relative">
            <DateInput
              value={local.due_date}
              onChange={(e) => {
                setLocal((l) => ({ ...l, due_date: e.target.value }));
                save({ due_date: e.target.value || null });
              }}
            />
          </div>
        </Field>
        <Field label="Время">
          <TimeInput
            value={local.due_time}
            onChange={(e) => {
              setLocal((l) => ({ ...l, due_time: e.target.value }));
              save({ due_time: e.target.value || null });
            }}
          />
        </Field>
      </div>

      <Field label="Длительность, мин">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={duration}
            placeholder="—"
            className="w-24"
            onChange={(e) => setDuration(e.target.value)}
            onBlur={commitDuration}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
          {DURATIONS.map((d) => (
            <Pill
              key={d}
              size="sm"
              active={duration === String(d)}
              onClick={() => {
                const next = duration === String(d) ? null : d;
                setDuration(next ? String(next) : "");
                save({ duration_min: next });
              }}
            >
              {d}
            </Pill>
          ))}
        </div>
      </Field>

      <Field label="Категория">
        <div className="flex flex-wrap gap-2">
          {(categories ?? []).map((c) => (
            <Pill
              key={c.id}
              color={c.color}
              active={local.category_id === c.id}
              onClick={() => {
                const next = local.category_id === c.id ? null : c.id;
                setLocal((l) => ({ ...l, category_id: next }));
                save({ category_id: next });
              }}
            >
              {c.name}
            </Pill>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Проект">
          <Select
            value={local.project_id ?? ""}
            onChange={(e) => {
              const v = e.target.value || null;
              setLocal((l) => ({ ...l, project_id: v }));
              save({ project_id: v, section_id: null });
            }}
          >
            <option value="">Без проекта</option>
            {activeProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.emoji ? `${p.emoji} ` : ""}
                {p.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Цель">
          <Select
            value={local.goal_id ?? ""}
            onChange={(e) => {
              const v = e.target.value || null;
              setLocal((l) => ({ ...l, goal_id: v }));
              save({ goal_id: v });
            }}
          >
            <option value="">Без цели</option>
            {activeGoals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Приоритет">
        <Segmented
          fullWidth
          value={local.priority}
          onChange={(priority) => {
            setLocal((l) => ({ ...l, priority }));
            save({ priority });
          }}
          options={PRIORITY_LABELS.map((label, value) => ({ value, label }))}
        />
      </Field>

      <Field label={`Подзадачи${task.subtasks.length ? ` · ${task.subtasks.filter((s) => s.done).length}/${task.subtasks.length}` : ""}`}>
        <div className="flex flex-col">
          {task.subtasks.map((s) => (
            <div key={s.id} className="group flex items-center gap-3 rounded-xl px-1 py-1.5 hover:bg-surface-2">
              <Checkbox
                size={20}
                checked={s.done}
                aria-label={s.title}
                onChange={() => toggle.mutate(s.id)}
              />
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="strike" data-done={s.done}>
                  {s.title}
                </span>
              </span>
              <IconButton
                label="Удалить подзадачу"
                size="sm"
                variant="danger"
                className="md:opacity-0 md:group-hover:opacity-100"
                onClick={() => del.mutate(s.id)}
              >
                <X />
              </IconButton>
            </div>
          ))}
          <div className="mt-1 flex items-center gap-2">
            <Input
              value={newSub}
              placeholder="Добавить подзадачу"
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSub();
                }
              }}
            />
            <IconButton label="Добавить" variant="secondary" onClick={addSub} disabled={!newSub.trim()}>
              <Plus />
            </IconButton>
          </div>
        </div>
      </Field>

      <div className="border-t border-line pt-4">
        {confirmDel ? (
          <div className="anim-fade flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm">Удалить задачу{task.subtasks.length ? " и подзадачи" : ""}?</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setConfirmDel(false)}>
                Отмена
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  del.mutate(task.id, {
                    onSuccess: () => {
                      toast.success("Задача удалена");
                      onClose();
                    },
                  })
                }
              >
                Да, удалить
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" icon={<Trash2 />} onClick={() => setConfirmDel(true)}>
            Удалить
          </Button>
        )}
      </div>
    </div>
  );
}
