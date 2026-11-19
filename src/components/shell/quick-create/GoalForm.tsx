"use client";
import { useState } from "react";
import { DateInput } from "@/components/ui/DateInput";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useCategories, useCreateGoal } from "@/lib/queries";
import type { GoalCreate } from "@/shared/schemas";
import { FormFooter } from "./FormFooter";

export function GoalForm({ defaults, onClose }: { defaults: Partial<GoalCreate>; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateGoal();
  const { data: categories = [] } = useCategories();
  const [title, setTitle] = useState(defaults.title ?? "");
  const [description, setDescription] = useState(defaults.description ?? "");
  const [date, setDate] = useState(defaults.target_date ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(defaults.category_id ?? null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    create.mutate(
      { ...defaults, title: title.trim(), description, target_date: date || null, category_id: categoryId },
      {
        onSuccess: () => {
          toast.success("Цель создана");
          onClose();
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="К чему вы идёте?" className="h-12 text-base" />
      <Field label="Описание">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Необязательно" />
      </Field>
      <Field label="Срок">
        <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
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
      <FormFooter onCancel={onClose} disabled={!title.trim()} loading={create.isPending} error={create.error?.message} />
    </form>
  );
}
