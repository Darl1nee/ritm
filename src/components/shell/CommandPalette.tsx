"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  CalendarDays,
  CalendarPlus,
  CircleCheck,
  FolderKanban,
  FolderPlus,
  LayoutGrid,
  ListChecks,
  Moon,
  NotebookPen,
  Search,
  Settings,
  Target,
} from "lucide-react";
import { Kbd } from "@/components/ui/Kbd";
import { useTheme } from "@/lib/hooks/theme";
import { useDebounced } from "@/lib/hooks/use-debounced";
import { useSearch, type SearchResult } from "@/lib/queries";
import { useCommandPalette } from "./command-palette-context";
import { useQuickCreate } from "./quick-create-context";

interface Action {
  id: string;
  label: string;
  icon: React.ReactNode;
  run: () => void;
}

const GROUPS: { type: SearchResult["type"]; label: string; icon: React.ReactNode }[] = [
  { type: "task", label: "Задачи", icon: <CircleCheck /> },
  { type: "project", label: "Проекты", icon: <FolderKanban /> },
  { type: "note", label: "Заметки", icon: <NotebookPen /> },
  { type: "event", label: "События", icon: <CalendarDays /> },
];

function hrefFor(r: SearchResult): string {
  switch (r.type) {
    case "task":
      return `/tasks?task=${r.id}`;
    case "project":
      return `/projects/${r.id}`;
    case "note":
      return `/notes?note=${r.id}`;
    case "event":
      return `/calendar?date=${(r.subtitle ?? "").slice(0, 10)}`;
  }
}

const itemCls =
  "flex h-10 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm text-fg data-[selected=true]:bg-surface-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-sub";
const headingCls =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-sub";

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !open) return null;
  return createPortal(<PaletteBody onClose={() => setOpen(false)} />, document.body);
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { open: openCreate } = useQuickCreate();
  const { toggleTheme, resolved } = useTheme();
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 150);
  const { data, isFetching } = useSearch(debounced);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, []);

  const actions = useMemo<Action[]>(
    () => [
      { id: "c-task", label: "Создать задачу", icon: <CircleCheck />, run: () => openCreate("task") },
      { id: "c-event", label: "Создать событие", icon: <CalendarPlus />, run: () => openCreate("event") },
      { id: "c-note", label: "Создать заметку", icon: <NotebookPen />, run: () => openCreate("note") },
      { id: "c-project", label: "Создать проект", icon: <FolderPlus />, run: () => openCreate("project") },
      { id: "c-goal", label: "Создать цель", icon: <Target />, run: () => openCreate("goal") },
      { id: "g-home", label: "Перейти: Обзор", icon: <LayoutGrid />, run: () => router.push("/") },
      { id: "g-tasks", label: "Перейти: Задачи", icon: <ListChecks />, run: () => router.push("/tasks") },
      { id: "g-projects", label: "Перейти: Проекты", icon: <FolderKanban />, run: () => router.push("/projects") },
      { id: "g-calendar", label: "Перейти: Календарь", icon: <CalendarDays />, run: () => router.push("/calendar") },
      { id: "g-notes", label: "Перейти: Заметки", icon: <NotebookPen />, run: () => router.push("/notes") },
      { id: "g-settings", label: "Перейти: Настройки", icon: <Settings />, run: () => router.push("/settings") },
      {
        id: "theme",
        label: resolved === "dark" ? "Включить светлую тему" : "Включить тёмную тему",
        icon: <Moon />,
        run: toggleTheme,
      },
    ],
    [openCreate, router, toggleTheme, resolved],
  );

  const q = query.trim().toLowerCase();
  const shownActions = q ? actions.filter((a) => a.label.toLowerCase().includes(q)) : actions;
  const results = debounced.trim() && data ? data.results : [];

  const run = (fn: () => void) => {
    onClose();
    // даём палитре закрыться, чтобы фокус не перехватил открываемая модалка
    setTimeout(fn, 0);
  };

  return (
    <div
      className="anim-fade fixed inset-0 z-50 flex items-start justify-center bg-[var(--overlay)] px-4 pt-[12vh] backdrop-blur-[6px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Command
        shouldFilter={false}
        loop
        label="Поиск и команды"
        className="anim-pop w-full max-w-[600px] overflow-hidden rounded-[24px] bg-surface text-fg shadow-pop ring-1 ring-line"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="flex items-center gap-3 border-b border-line px-5">
          <Search size={18} className="shrink-0 text-fg-sub" />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Поиск задач, проектов, заметок, событий…"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-sub"
          />
          <Kbd>Esc</Kbd>
        </div>
        <Command.List className={`max-h-[min(420px,60vh)] overflow-y-auto p-2 ${headingCls}`}>
          {q && results.length === 0 && shownActions.length === 0 && !isFetching && (
            <Command.Empty className="px-3 py-8 text-center text-sm text-fg-sub">Ничего не найдено</Command.Empty>
          )}
          {GROUPS.map((g) => {
            const items = results.filter((r) => r.type === g.type);
            if (items.length === 0) return null;
            return (
              <Command.Group key={g.type} heading={g.label}>
                {items.map((r) => (
                  <Command.Item key={`${r.type}-${r.id}`} value={`${r.type}-${r.id}`} className={itemCls} onSelect={() => run(() => router.push(hrefFor(r)))}>
                    {g.icon}
                    <span className="min-w-0 flex-1 truncate">{r.title || "Без названия"}</span>
                    {r.subtitle && <span className="shrink-0 text-xs text-fg-sub">{r.subtitle}</span>}
                  </Command.Item>
                ))}
              </Command.Group>
            );
          })}
          {shownActions.length > 0 && (
            <Command.Group heading="Действия">
              {shownActions.map((a) => (
                <Command.Item key={a.id} value={a.id} className={itemCls} onSelect={() => run(a.run)}>
                  {a.icon}
                  {a.label}
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </div>
  );
}
