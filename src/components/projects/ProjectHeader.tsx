"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { CalendarDays, ChevronDown, ChevronLeft, MoreHorizontal, Palette, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Menu } from "@/components/ui/Menu";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useToast } from "@/components/ui/Toast";
import { useDeleteProject, useUpdateProject, type ProjectDetail } from "@/lib/queries";
import { PALETTE, PROJECT_TYPE_INFO } from "@/lib/ui-constants";
import { PROJECT_STATUSES, type ProjectUpdate } from "@/shared/schemas";
import { ConfirmModal } from "./ConfirmModal";
import { InlineText } from "./InlineText";
import { STATUS_LABELS, STATUS_TONE, projectOverdue, shortDate, soft } from "./utils";

export function ProjectHeader({ project: p }: { project: ProjectDetail }) {
  const router = useRouter();
  const toast = useToast();
  const update = useUpdateProject();
  const del = useDeleteProject();
  const [settings, setSettings] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const info = PROJECT_TYPE_INFO[p.type];
  const late = projectOverdue(p);
  const save = (patch: ProjectUpdate) => update.mutate({ id: p.id, ...patch });

  const dates =
    p.type === "trip" && p.start_date && p.due_date
      ? `${shortDate(p.start_date)} — ${shortDate(p.due_date)}`
      : p.due_date
        ? `до ${shortDate(p.due_date)}`
        : p.start_date
          ? `с ${shortDate(p.start_date)}`
          : null;

  return (
    <header className="pb-5 pt-5 md:pt-7">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href="/projects"
          className="-ml-1 inline-flex items-center gap-0.5 rounded-full py-1 pl-1 pr-3 text-sm text-fg-sub transition-colors hover:text-fg"
        >
          <ChevronLeft size={18} />
          Проекты
        </Link>
      </div>

      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => setSettings(true)}
          aria-label="Изменить цвет и эмодзи"
          className="flex size-14 shrink-0 items-center justify-center rounded-full text-3xl transition-transform duration-150 hover:scale-105"
          style={{ background: soft(p.color, "2b") }}
        >
          {p.emoji || info.emoji}
        </button>
        <div className="min-w-0 flex-1">
          <InlineText
            value={p.title}
            onSave={(title) => save({ title })}
            aria-label="Название проекта"
            className="block w-full truncate text-[28px] font-bold leading-tight tracking-[-0.01em]"
            inputClassName="text-[28px] font-bold leading-tight"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
            <span className="rounded-full bg-surface-2 px-3 py-1 font-medium text-fg-sub">
              {info.emoji} {info.label}
            </span>
            <Menu
              items={PROJECT_STATUSES.map((s) => ({ label: STATUS_LABELS[s], onSelect: () => save({ status: s }) }))}
              trigger={
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Статус проекта"
                  className={clsx("inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 font-medium", STATUS_TONE[p.status])}
                >
                  {STATUS_LABELS[p.status]}
                  <ChevronDown size={13} />
                </span>
              }
            />
            {dates && (
              <button
                type="button"
                onClick={() => setSettings(true)}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors hover:bg-surface-2",
                  late ? "text-danger" : "text-fg-sub",
                )}
              >
                <CalendarDays size={14} />
                {dates}
                {late && " · просрочен"}
              </button>
            )}
            {!dates && (
              <button type="button" onClick={() => setSettings(true)} className="rounded-full px-3 py-1 text-fg-sub hover:bg-surface-2">
                + Срок
              </button>
            )}
          </div>
        </div>
        <Menu
          align="end"
          trigger={
            <IconButton label="Действия с проектом" variant="secondary" className="pointer-events-none">
              <MoreHorizontal />
            </IconButton>
          }
          items={[
            { label: "Цвет, эмодзи и сроки", icon: <Palette />, onSelect: () => setSettings(true) },
            "divider",
            { label: "Удалить проект", icon: <Trash2 />, danger: true, onSelect: () => setConfirm(true) },
          ]}
        />
      </div>

      <div className="mt-3 max-w-2xl text-sm text-fg-sub">
        <InlineText
          value={p.description}
          onSave={(description) => save({ description })}
          placeholder="Добавить описание"
          aria-label="Описание проекта"
          multiline
          allowEmpty
          className="block leading-relaxed"
        />
      </div>

      <div className="mt-4 flex max-w-2xl items-center gap-3">
        <ProgressBar value={p.progress.percent} color={p.color} height={8} />
        <span className="shrink-0 text-[13px] tabular-nums text-fg-sub">
          {p.progress.done} из {p.progress.total} · {p.progress.percent}%
        </span>
      </div>

      <SettingsModal open={settings} onClose={() => setSettings(false)} project={p} onSave={(patch) => save(patch)} />
      <ConfirmModal
        open={confirm}
        title="Удалить проект?"
        text={`«${p.title}» будет удалён вместе со всеми задачами. Заметки останутся, но потеряют привязку. Это нельзя отменить.`}
        loading={del.isPending}
        onConfirm={() =>
          del.mutate(p.id, {
            onSuccess: () => {
              toast.success("Проект удалён");
              router.push("/projects");
            },
          })
        }
        onClose={() => setConfirm(false)}
      />
    </header>
  );
}

function SettingsModal({
  open,
  onClose,
  project: p,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  project: ProjectDetail;
  onSave: (patch: { emoji: string | null; color: string; start_date: string | null; due_date: string | null }) => void;
}) {
  // Форма пересоздаётся при каждом открытии (key), поэтому начальные значения берутся из проекта.
  return (
    <Modal open={open} onClose={onClose} title="Оформление и сроки" width={440}>
      <SettingsForm key={String(open)} project={p} onClose={onClose} onSave={onSave} />
    </Modal>
  );
}

function SettingsForm({
  project: p,
  onClose,
  onSave,
}: {
  project: ProjectDetail;
  onClose: () => void;
  onSave: (patch: { emoji: string | null; color: string; start_date: string | null; due_date: string | null }) => void;
}) {
  const [emoji, setEmoji] = useState(p.emoji ?? "");
  const [color, setColor] = useState(p.color);
  const [start, setStart] = useState(p.start_date ?? "");
  const [due, setDue] = useState(p.due_date ?? "");
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ emoji: emoji.trim() || null, color, start_date: start || null, due_date: due || null });
        onClose();
      }}
    >
      <Field label="Эмодзи">
        <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder={PROJECT_TYPE_INFO[p.type].emoji} maxLength={8} className="w-24 text-center text-xl" />
      </Field>
      <Field label="Цвет">
        <div className="flex flex-wrap gap-3">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Цвет ${c}`}
              aria-pressed={color.toLowerCase() === c}
              onClick={() => setColor(c)}
              className="size-8 rounded-full transition-transform duration-150 hover:scale-110"
              style={{ background: c, boxShadow: color.toLowerCase() === c ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}` : undefined }}
            />
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Начало">
          <DateInput value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Срок">
          <DateInput value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose}>
          Отмена
        </Button>
        <Button variant="primary" type="submit">
          Сохранить
        </Button>
      </div>
    </form>
  );
}
