import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";
import type { CalendarEvent, Task } from "@/lib/queries";
import type { EventType } from "@/shared/schemas";

export type CalView = "day" | "3days" | "week" | "month" | "list";

export const HOUR_H = 48;
export const MIN_H = HOUR_H / 60;
export const DAY_MIN = 24 * 60;
export const LIST_DAYS = 30;

export const ymd = (d: Date) => format(d, "yyyy-MM-dd");

export function parseDateParam(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = parseISO(s);
  return isValid(d) ? d : null;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function atMinutes(day: Date, minutes: number): Date {
  const x = startOfDay(day);
  x.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return x;
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Дни, отображаемые в сетке часов. */
export function gridDays(view: CalView, date: Date): Date[] {
  const d0 = startOfDay(date);
  if (view === "day") return [d0];
  if (view === "3days") return [0, 1, 2].map((i) => addDays(d0, i));
  const s = startOfWeek(d0, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

export function monthGridRange(month: Date): { from: Date; to: Date } {
  const from = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  return { from, to: addDays(from, 41) };
}

/** Видимый диапазон основного вида (обе границы включительно). */
export function visibleRange(view: CalView, date: Date): { from: Date; to: Date } {
  if (view === "month") return monthGridRange(date);
  if (view === "list") return { from: startOfDay(date), to: addDays(startOfDay(date), LIST_DAYS - 1) };
  const days = gridDays(view, date);
  return { from: days[0], to: days[days.length - 1] };
}

export function weekOf(date: Date): { from: Date; to: Date } {
  return {
    from: startOfWeek(date, { weekStartsOn: 1 }),
    to: endOfWeek(date, { weekStartsOn: 1 }),
  };
}

export function shiftDate(view: CalView, date: Date, dir: 1 | -1): Date {
  switch (view) {
    case "day":
      return addDays(date, dir);
    case "3days":
      return addDays(date, 3 * dir);
    case "week":
      return addDays(date, 7 * dir);
    case "month": {
      const m = addMonths(startOfMonth(date), dir);
      return m;
    }
    case "list":
      return addDays(date, LIST_DAYS * dir);
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function periodTitle(view: CalView, date: Date, now: Date): string {
  const withYear = (d: Date) => d.getFullYear() !== now.getFullYear();
  if (view === "month") return cap(format(date, "LLLL yyyy", { locale: ru }));
  if (view === "day") return cap(format(date, "EEEE, d MMMM", { locale: ru }));
  const { from, to } = visibleRange(view, date);
  const yr = withYear(from) || withYear(to);
  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
    return `${from.getDate()} – ${format(to, yr ? "d MMMM yyyy" : "d MMMM", { locale: ru })}`;
  }
  const f = yr ? "d MMM yyyy" : "d MMM";
  return `${format(from, f, { locale: ru })} – ${format(to, f, { locale: ru })}`.replace(/\./g, "");
}

export function monthName(d: Date): string {
  return cap(format(d, "LLLL yyyy", { locale: ru }));
}

export function fmtTime(d: Date): string {
  return format(d, "HH:mm");
}

export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h && m) return `${h} ч ${m} мин`;
  if (h) return `${h} ч`;
  return `${m} мин`;
}

export function dayLabel(day: Date, now: Date): string {
  const t = startOfDay(now);
  if (sameDay(day, t)) return "Сегодня";
  if (sameDay(day, addDays(t, 1))) return "Завтра";
  return cap(format(day, "EEEEEE, d MMMM", { locale: ru }));
}

// ---------- Нормализованные элементы календаря ----------

export interface CalItem {
  key: string;
  kind: "event" | "task";
  id: string;
  title: string;
  color: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string;
  type?: EventType;
  done?: boolean;
  event?: CalendarEvent;
  task?: Task;
}

export function eventItem(e: CalendarEvent, color: string): CalItem {
  return {
    key: `e:${e.id}`,
    kind: "event",
    id: e.id,
    title: e.title,
    color,
    start: new Date(e.start_at),
    end: new Date(e.end_at),
    allDay: e.all_day,
    location: e.location || undefined,
    type: e.type,
    event: e,
  };
}

export function taskItem(t: Task, color: string): CalItem | null {
  if (!t.due_date) return null;
  const day = parseISO(t.due_date);
  if (!isValid(day)) return null;
  if (t.due_time && /^\d{2}:\d{2}$/.test(t.due_time)) {
    const [h, m] = t.due_time.split(":").map(Number);
    const start = atMinutes(day, h * 60 + m);
    const dur = t.duration_min ?? 30;
    return {
      key: `t:${t.id}`,
      kind: "task",
      id: t.id,
      title: t.title,
      color,
      start,
      end: new Date(start.getTime() + dur * 60000),
      allDay: false,
      done: t.done,
      task: t,
    };
  }
  return {
    key: `t:${t.id}`,
    kind: "task",
    id: t.id,
    title: t.title,
    color,
    start: startOfDay(day),
    end: addDays(startOfDay(day), 1),
    allDay: true,
    done: t.done,
    task: t,
  };
}

/** Пересекает ли элемент сутки `day`. */
export function overlapsDay(it: CalItem, day: Date): boolean {
  const s = startOfDay(day).getTime();
  const e = addDays(startOfDay(day), 1).getTime();
  if (it.end.getTime() <= it.start.getTime()) return it.start.getTime() >= s && it.start.getTime() < e;
  return it.start.getTime() < e && it.end.getTime() > s;
}

export function sortItems(a: CalItem, b: CalItem): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime();
}

// ---------- Раскладка пересечений ----------

export interface Seg {
  item: CalItem;
  startMin: number;
  endMin: number;
  col: number;
  cols: number;
}

const MIN_VISUAL = 20; // минут: минимальная высота блока при раскладке

/** Классический алгоритм: кластеры пересекающихся блоков делят ширину колонки. */
export function layoutDay(items: CalItem[], day: Date): Seg[] {
  const d0 = startOfDay(day).getTime();
  const segs: Seg[] = items
    .map((item) => {
      const s = Math.max(0, Math.round((item.start.getTime() - d0) / 60000));
      let e = Math.min(DAY_MIN, Math.round((item.end.getTime() - d0) / 60000));
      if (e < s + MIN_VISUAL) e = Math.min(DAY_MIN, s + MIN_VISUAL);
      return { item, startMin: s, endMin: e, col: 0, cols: 1 };
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  let cluster: Seg[] = [];
  let clusterEnd = -1;
  const flush = () => {
    if (!cluster.length) return;
    const colEnds: number[] = [];
    for (const sg of cluster) {
      let c = colEnds.findIndex((end) => end <= sg.startMin);
      if (c === -1) {
        c = colEnds.length;
        colEnds.push(sg.endMin);
      } else colEnds[c] = sg.endMin;
      sg.col = c;
    }
    for (const sg of cluster) sg.cols = colEnds.length;
    cluster = [];
  };
  for (const sg of segs) {
    if (cluster.length && sg.startMin >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    cluster.push(sg);
    clusterEnd = Math.max(clusterEnd, sg.endMin);
  }
  flush();
  return segs;
}

export const snap = (m: number, step: number) => Math.round(m / step) * step;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const bgOf = (color: string, pct = 14) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

/** Одно ли локальное число у события (для перетаскивания). */
export function isSingleDay(it: CalItem): boolean {
  return !it.allDay && sameDay(it.start, new Date(it.end.getTime() - 1 < it.start.getTime() ? it.start : it.end.getTime() - 1));
}

export { addDays, endOfMonth, startOfMonth };
