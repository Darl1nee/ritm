"use client";
import { useState } from "react";
import clsx from "clsx";
import { DateInput } from "@/components/ui/DateInput";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useCreateProject } from "@/lib/queries";
import { PALETTE, PROJECT_TYPE_INFO } from "@/lib/ui-constants";
import { PROJECT_TYPES, type ProjectCreate, type ProjectType } from "@/shared/schemas";
import { FormFooter } from "./FormFooter";

export function ProjectForm({ defaults, onClose }: { defaults: Partial<ProjectCreate>; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateProject();
  const [title, setTitle] = useState(defaults.title ?? "");
  const [type, setType] = useState<ProjectType>(defaults.type ?? "project");
  const [emoji, setEmoji] = useState<string | null>(defaults.emoji ?? null);
  const [color, setColor] = useState(defaults.color ?? PALETTE[0]);
  const [due, setDue] = useState(defaults.due_date ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    create.mutate(
      {
        ...defaults,
        title: title.trim(),
        type,
        color,
        emoji: (emoji ?? PROJECT_TYPE_INFO[type].emoji).trim() || null,
        due_date: due || null,
      },
      {
        onSuccess: () => {
          toast.success("Проект создан");
          onClose();
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название проекта" className="h-12 text-base" />
      <Field label="Тип">
        <div className="grid grid-cols-2 gap-2">
          {PROJECT_TYPES.map((t) => {
            const info = PROJECT_TYPE_INFO[t];
            const active = type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={active}
                className={clsx(
                  "flex flex-col items-start gap-1 rounded-2xl p-3.5 text-left transition-colors duration-150",
                  active ? "bg-accent-soft ring-2 ring-accent" : "bg-surface-2 hover:brightness-[0.97] dark:hover:brightness-125",
                )}
              >
                <span className="text-[14px] font-semibold">
                  {info.emoji} {info.label}
                </span>
                <span className="text-xs leading-snug text-fg-sub">{info.description}</span>
              </button>
            );
          })}
        </div>
      </Field>
      <div className="grid grid-cols-[88px_1fr] gap-3">
        <Field label="Эмодзи">
          <Input
            value={emoji ?? ""}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder={PROJECT_TYPE_INFO[type].emoji}
            maxLength={4}
            className="text-center text-lg"
          />
        </Field>
        <Field label="Срок">
          <DateInput value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
      </div>
      <Field label="Цвет">
        <div className="flex flex-wrap gap-2.5">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className="size-7 rounded-full transition-transform duration-150 hover:scale-110"
              style={{ background: c, boxShadow: color === c ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}` : undefined }}
            />
          ))}
        </div>
      </Field>
      <FormFooter onCancel={onClose} disabled={!title.trim()} loading={create.isPending} error={create.error?.message} />
    </form>
  );
}
