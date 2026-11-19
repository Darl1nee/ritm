"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CardHeader } from "@/components/ui/CardHeader";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useTheme } from "@/lib/hooks/theme";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useSettings,
  useUpdateCategory,
  useUpdateSettings,
  type Category,
  type Settings,
} from "@/lib/queries";
import { ActivityLog } from "@/components/settings/ActivityLog";
import { McpSection } from "@/components/settings/McpSection";
import { ACCENT_COLORS, PALETTE } from "@/lib/ui-constants";
import { Palette, Tags, Timer, User } from "lucide-react";

export default function SettingsPage() {
  const { data: settings } = useSettings();
  return (
    <>
      <PageHeader title="Настройки" />
      {settings ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <ProfileCard settings={settings} />
          <AppearanceCard />
          <FocusCard settings={settings} />
          <CategoriesCard />
          <McpSection />
          <ActivityLog />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 rounded-card" />
          ))}
        </div>
      )}
    </>
  );
}

/** Текстовое поле с сохранением по blur и Enter. */
function SaveInput({
  value,
  onSave,
  ...rest
}: { value: string; onSave: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => {
    if (v !== value) onSave(v);
  };
  return (
    <Input
      {...rest}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function ProfileCard({ settings }: { settings: Settings }) {
  const update = useUpdateSettings();
  return (
    <Card>
      <CardHeader icon={<User />} title="Профиль" subtitle="Как к вам обращаться" className="mb-5" />
      <Field label="Имя">
        <SaveInput
          value={settings.user_name}
          placeholder="Ваше имя"
          onSave={(v) => v.trim() && update.mutate({ user_name: v.trim() })}
        />
      </Field>
    </Card>
  );
}

function AppearanceCard() {
  const { theme, setTheme, accent, setAccent } = useTheme();
  return (
    <Card>
      <CardHeader icon={<Palette />} title="Внешний вид" subtitle="Тема и акцентный цвет" className="mb-5" />
      <div className="flex flex-col gap-5">
        <Field label="Тема">
          <Segmented
            value={theme}
            onChange={setTheme}
            options={[
              { value: "light", label: "Светлая" },
              { value: "dark", label: "Тёмная" },
              { value: "system", label: "Системная" },
            ]}
          />
        </Field>
        <Field label="Акцент">
          <div className="flex flex-wrap gap-3">
            {ACCENT_COLORS.map((c) => {
              const active = accent.toLowerCase() === c;
              return (
                <button
                  key={c}
                  type="button"
                  aria-label={`Акцент ${c}`}
                  aria-pressed={active}
                  onClick={() => setAccent(c)}
                  className="flex size-8 items-center justify-center rounded-full text-white transition-transform duration-150 hover:scale-110"
                  style={{ background: c, boxShadow: active ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}` : undefined }}
                >
                  {active && <Check size={16} strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </Field>
      </div>
    </Card>
  );
}

function FocusCard({ settings }: { settings: Settings }) {
  const update = useUpdateSettings();
  const num = (key: "focus_length_min" | "focus_goal_min") => (v: string) => {
    const n = Math.round(Number(v));
    if (Number.isFinite(n) && n > 0 && n <= 1440) update.mutate({ [key]: n });
  };
  return (
    <Card>
      <CardHeader icon={<Timer />} title="Фокус" subtitle="Длина сессии и цель на день" className="mb-5" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Длина сессии, мин">
          <SaveInput type="number" min={1} max={1440} value={String(settings.focus_length_min)} onSave={num("focus_length_min")} />
        </Field>
        <Field label="Цель в день, мин">
          <SaveInput type="number" min={1} max={1440} value={String(settings.focus_goal_min)} onSave={num("focus_goal_min")} />
        </Field>
      </div>
    </Card>
  );
}

function CategoriesCard() {
  const { data: categories = [], isLoading } = useCategories();
  const create = useCreateCategory();
  const toast = useToast();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PALETTE[0]);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), color },
      {
        onSuccess: () => setName(""),
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <Card>
      <CardHeader icon={<Tags />} title="Категории" subtitle="Метки для задач и целей" className="mb-4" />
      <div className="flex flex-col">
        {isLoading && <Skeleton className="h-10" />}
        {categories.map((c) => (
          <CategoryRow key={c.id} category={c} />
        ))}
      </div>
      <form onSubmit={add} className="mt-3 flex items-center gap-2">
        <ColorDot color={color} onChange={setColor} />
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Новая категория" />
        <Button type="submit" variant="secondary" icon={<Plus />} disabled={!name.trim() || create.isPending}>
          Добавить
        </Button>
      </form>
    </Card>
  );
}

function ColorDot({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <label
      className="relative inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full ring-2 ring-surface-2 transition-transform duration-150 hover:scale-110"
      style={{ background: color }}
      title="Изменить цвет"
    >
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
        aria-label="Цвет категории"
      />
    </label>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const update = useUpdateCategory();
  const del = useDeleteCategory();
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 3000);
    return () => clearTimeout(t);
  }, [confirm]);

  return (
    <div className="flex items-center gap-2 py-1.5">
      <ColorDot color={category.color} onChange={(c) => update.mutate({ id: category.id, color: c })} />
      <SaveInput
        value={category.name}
        aria-label="Название категории"
        className="bg-transparent hover:bg-surface-2"
        onSave={(v) => v.trim() && update.mutate({ id: category.id, name: v.trim() })}
      />
      {confirm ? (
        <Button variant="danger" size="sm" onClick={() => del.mutate(category.id)} className={clsx("shrink-0")}>
          Удалить?
        </Button>
      ) : (
        <IconButton label="Удалить категорию" variant="danger" size="sm" onClick={() => setConfirm(true)}>
          <Trash2 />
        </IconButton>
      )}
    </div>
  );
}
