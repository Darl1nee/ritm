"use client";
import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { DateInput } from "@/components/ui/DateInput";
import { TimeInput } from "@/components/ui/TimeInput";
import { Pill } from "@/components/ui/Pill";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { useCategories, useCreateTask, useProjects } from "@/lib/queries";
import { BUCKET_LABELS, PRIORITY_LABELS } from "@/lib/ui-constants";
import { BUCKETS, type Bucket, type TaskCreate } from "@/shared/schemas";
import { FormFooter } from "./FormFooter";

export function TaskForm({ defaults, onClose }: { defaults: Partial<TaskCreate>; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateTask();
  const { data: categories = [] } = useCategories();
  const { data: projects = [] } = useProjects({ status: "active" });

  const [title, setTitle] = useState(defaults.title ?? "");
  const [bucket, setBucket] = useState<Bucket>(defaults.bucket ?? (defaults.due_date ? "week" : "today"));
  const [date, setDate] = useState(defaults.due_date ?? "");
  const [time, setTime] = useState(defaults.due_time ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(defaults.category_id ?? null);
  const [projectId, setProjectId] = useState<string>(defaults.project_id ?? "");
  const [priority, setPriority] = useState(defaults.priority ?? 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    create.mutate(
      {
        ...defaults,
        title: title.trim(),
        bucket,
        due_date: date || null,
        due_time: date && time ? time : null,
        category_id: categoryId,
        project_id: projectId || null,
        priority,
      },
      {
        onSuccess: () => {
          toast.success("Задача создана");
          onClose();
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Что нужно сделать?" className="h-12 text-base" />
      <Field label="Когда">
        <Segmented
          fullWidth
          value={bucket}
          onChange={setBucket}
          options={BUCKETS.map((b) => ({ value: b, label: BUCKET_LABELS[b] }))}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Дата">
          <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Время">
          <TimeInput value={time} onChange={(e) => setTime(e.target.value)} disabled={!date} />
        </Field>
      </div>
      {categories.length > 0 && (
        <Field label="Категория">
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Pill key={c.id} color={c.color} active={categoryId === c.id} onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}>
                {c.name}
              </Pill>
            ))}
          </div>
        </Field>
      )}
      <div className="flex flex-col gap-4">
        <Field label="Проект">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Без проекта</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.emoji ? `${p.emoji} ` : ""}
                {p.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Приоритет">
          <Segmented
            fullWidth
            size="sm"
            value={priority}
            onChange={setPriority}
            options={PRIORITY_LABELS.map((l, i) => ({ value: i, label: l }))}
          />
        </Field>
      </div>
      <FormFooter onCancel={onClose} disabled={!title.trim()} loading={create.isPending} error={create.error?.message} />
    </form>
  );
}
