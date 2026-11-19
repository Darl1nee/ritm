"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useQuickCreate } from "@/components/shell/quick-create-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCategories, useToggleTask, type CalendarEvent } from "@/lib/queries";
import { readStorage, writeStorage } from "@/lib/storage";
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "@/lib/ui-constants";
import { EVENT_TYPES } from "@/shared/schemas";
import { useMediaQuery, useMoveEvent, useNow, useRangeData } from "./data";
import { EventDialog } from "./EventDialog";
import { ListView } from "./ListView";
import { MonthGrid } from "./MonthGrid";
import { MiniCalendar, TimeSpentCard, TodayCard } from "./SidePanels";
import { TimeGrid } from "./TimeGrid";
import {
  atMinutes,
  eventItem,
  gridDays,
  monthGridRange,
  parseDateParam,
  periodTitle,
  shiftDate,
  startOfDay,
  taskItem,
  visibleRange,
  weekOf,
  ymd,
  type CalItem,
  type CalView,
} from "./utils";

const STORAGE_KEY = "ritm.calendar.hidden";
const VIEWS: CalView[] = ["day", "3days", "week", "month", "list"];

const WIDE_OPTIONS: { value: CalView; label: string }[] = [
  { value: "3days", label: "3 дня" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "list", label: "Список" },
];
const NARROW_OPTIONS: { value: CalView; label: string }[] = [
  { value: "day", label: "День" },
  { value: "3days", label: "3 дня" },
  { value: "month", label: "Месяц" },
  { value: "list", label: "Список" },
];

export function CalendarView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { open: openCreate } = useQuickCreate();
  const now = useNow();
  const narrow = useMediaQuery("(max-width: 639px)");

  // ---- URL: вид и дата ----
  const rawView = params.get("view");
  const urlView = VIEWS.includes(rawView as CalView) ? (rawView as CalView) : null;
  let view: CalView = urlView ?? (narrow ? "day" : "week");
  if (narrow && view === "week") view = "3days";
  if (!narrow && view === "day") view = "3days";
  const date = useMemo(() => parseDateParam(params.get("date")) ?? startOfDay(new Date()), [params]);

  const navigate = useCallback(
    (nextView: CalView, nextDate: Date) => {
      const sp = new URLSearchParams({ view: nextView, date: ymd(nextDate) });
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [router, pathname],
  );

  // ---- Фильтры и поиск ----
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => {
    try {
      const v = JSON.parse(readStorage(STORAGE_KEY) ?? "[]");
      if (Array.isArray(v)) setHidden(v.filter((x) => typeof x === "string"));
    } catch {
      /* ignore */
    }
  }, []);
  const toggleHidden = (k: string) =>
    setHidden((h) => {
      const next = h.includes(k) ? h.filter((x) => x !== k) : [...h, k];
      writeStorage(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  const [query, setQuery] = useState("");

  // ---- Данные ----
  const [miniMonth, setMiniMonth] = useState(() => startOfMonth(date));
  const monthKey = ymd(startOfMonth(date));
  useEffect(() => setMiniMonth(startOfMonth(parseDateParam(monthKey) ?? new Date())), [monthKey]);

  const main = visibleRange(view, date);
  const week = weekOf(date);
  const mini = monthGridRange(miniMonth);
  const fromD = new Date(Math.min(main.from.getTime(), week.from.getTime(), mini.from.getTime()));
  const toD = new Date(Math.max(main.to.getTime(), week.to.getTime(), mini.to.getTime()));
  const data = useRangeData(fromD, toD);
  const todayD = startOfDay(now ?? new Date());
  const todayData = useRangeData(todayD, todayD);

  const { data: categories } = useCategories();
  const catColor = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c.color])), [categories]);

  const allItems = useMemo<CalItem[]>(() => {
    const list: CalItem[] = [];
    for (const e of data.events ?? []) list.push(eventItem(e, EVENT_TYPE_COLORS[e.type]));
    for (const t of data.tasks ?? []) {
      const it = taskItem(t, (t.category_id && catColor.get(t.category_id)) || "var(--accent)");
      if (it) list.push(it);
    }
    return list;
  }, [data.events, data.tasks, catColor]);

  const todayItems = useMemo<CalItem[]>(() => {
    const list: CalItem[] = [];
    for (const e of todayData.events ?? []) list.push(eventItem(e, EVENT_TYPE_COLORS[e.type]));
    for (const t of todayData.tasks ?? []) {
      const it = taskItem(t, (t.category_id && catColor.get(t.category_id)) || "var(--accent)");
      if (it) list.push(it);
    }
    return list;
  }, [todayData.events, todayData.tasks, catColor]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allItems.filter((it) => {
      if (it.kind === "task" ? hidden.includes("tasks") : it.type && hidden.includes(it.type)) return false;
      return !q || it.title.toLowerCase().includes(q);
    });
  }, [allItems, hidden, query]);

  // ---- Действия ----
  const toggleTask = useToggleTask();
  const moveEvent = useMoveEvent();
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const openEvent = (id: string) => setEditing(data.events?.find((e) => e.id === id) ?? todayData.events?.find((e) => e.id === id) ?? null);
  const openTask = (id: string) => router.push(`/tasks?task=${id}`);
  const create = (start: Date, end: Date) => openCreate("event", { start_at: start.toISOString(), end_at: end.toISOString() });
  const createOnDay = (d: Date) => create(atMinutes(d, 600), atMinutes(d, 660));
  const goToday = () => navigate(view, new Date());

  // ---- Горячие клавиши ----
  const options = narrow ? NARROW_OPTIONS : WIDE_OPTIONS;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === "ArrowLeft") navigate(view, shiftDate(view, date, -1));
      else if (e.key === "ArrowRight") navigate(view, shiftDate(view, date, 1));
      else if (e.key === "t" || e.key === "T" || e.key === "е" || e.key === "Е") navigate(view, new Date());
      else if (/^[1-4]$/.test(e.key)) navigate(options[Number(e.key) - 1].value, date);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, view, date, options]);

  const title = periodTitle(view, date, now ?? new Date());
  const highlight = view === "month" || view === "list" ? weekOf(date) : main;
  const isGrid = view === "day" || view === "3days" || view === "week";

  return (
    <>
      <PageHeader title="Календарь" />
      <div className="grid grid-cols-1 items-start gap-5 min-[1100px]:grid-cols-[minmax(0,1fr)_280px]">
        <Card padded={false} className="min-w-0 p-3 sm:p-5">
          {/* Тулбар */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="min-w-0 truncate text-[20px] font-semibold tracking-[-0.01em]">{title}</h2>
              <div className="flex shrink-0 items-center gap-1">
                <IconButton label="Назад" size="sm" variant="secondary" onClick={() => navigate(view, shiftDate(view, date, -1))}>
                  <ChevronLeft />
                </IconButton>
                <Button size="sm" onClick={goToday}>
                  Сегодня
                </Button>
                <IconButton label="Вперёд" size="sm" variant="secondary" onClick={() => navigate(view, shiftDate(view, date, 1))}>
                  <ChevronRight />
                </IconButton>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[160px] flex-1 sm:max-w-[280px]">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-sub" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск событий"
                  aria-label="Поиск событий"
                  className="h-9 rounded-full pl-9"
                />
              </div>
              <Segmented aria-label="Вид календаря" options={options} value={view} onChange={(v) => navigate(v, date)} className="max-sm:w-full" fullWidth={narrow} />
            </div>
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {EVENT_TYPES.map((t) => (
                <Pill key={t} size="sm" color={EVENT_TYPE_COLORS[t]} active={!hidden.includes(t)} onClick={() => toggleHidden(t)}>
                  {EVENT_TYPE_LABELS[t]}
                </Pill>
              ))}
              <Pill size="sm" color="var(--fg-sub)" active={!hidden.includes("tasks")} onClick={() => toggleHidden("tasks")}>
                Задачи
              </Pill>
            </div>
          </div>

          {/* Тело */}
          <div className={clsx("mt-3", !isGrid && "min-h-[300px]")}>
            {data.loading ? (
              <Skeleton className="h-[480px] rounded-[16px]" />
            ) : data.error ? (
              <p className="py-10 text-center text-sm text-danger">Не удалось загрузить календарь: {data.error.message}</p>
            ) : isGrid ? (
              <TimeGrid
                key={view}
                days={gridDays(view, date)}
                items={shown}
                now={now}
                onOpenEvent={openEvent}
                onOpenTask={openTask}
                onToggleTask={(id) => toggleTask.mutate(id)}
                onCreate={create}
                onMove={(id, s, e) => moveEvent.mutate({ id, start_at: s.toISOString(), end_at: e.toISOString() })}
              />
            ) : view === "month" ? (
              <MonthGrid
                month={date}
                items={shown}
                now={now}
                onOpenEvent={openEvent}
                onOpenTask={openTask}
                onCreateAt={create}
                onGoWeek={(d) => navigate(narrow ? "day" : "week", d)}
              />
            ) : (
              <ListView
                from={date}
                items={shown}
                now={now}
                onOpenEvent={openEvent}
                onOpenTask={openTask}
                onToggleTask={(id) => toggleTask.mutate(id)}
                onCreate={() => createOnDay(date)}
              />
            )}
          </div>
        </Card>

        {/* Правая колонка */}
        <aside className="grid min-w-0 grid-cols-1 gap-5 md:max-[1099px]:grid-cols-3">
          <MiniCalendar
            month={miniMonth}
            onMonthChange={setMiniMonth}
            selected={date}
            highlight={highlight}
            items={allItems}
            now={now}
            onPick={(d) => navigate(view, d)}
          />
          <TodayCard
            items={todayItems}
            loading={todayData.loading}
            now={now}
            onOpenEvent={openEvent}
            onOpenTask={openTask}
            onToggleTask={(id) => toggleTask.mutate(id)}
          />
          <TimeSpentCard events={data.events} week={week} loading={data.loading} />
        </aside>
      </div>
      <EventDialog event={editing} onClose={() => setEditing(null)} />
    </>
  );
}
