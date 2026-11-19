import { addDays, format, parseISO, startOfDay } from "date-fns";

export interface BusyInterval {
  /** Начало, мс. */
  start: number;
  /** Конец, мс. */
  end: number;
}

export interface FreeWindow {
  start: string;
  end: string;
  minutes: number;
}

/** Локальный момент даты `YYYY-MM-DD` и времени `HH:MM` (поддерживает 24:00). */
export function localMs(date: string, hhmm: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0).getTime();
}

/**
 * Занятый интервал события. Событие «на весь день» занимает целые локальные сутки
 * (от начала первого дня до конца последнего), независимо от записанных часов.
 */
export function busyOfEvent(e: { start_at: string; end_at: string; all_day: boolean }): BusyInterval {
  const start = Date.parse(e.start_at);
  const end = Date.parse(e.end_at);
  if (!e.all_day) return { start, end };
  const first = startOfDay(new Date(start));
  const lastDay = startOfDay(new Date(Math.max(start, end > start ? end - 1 : end)));
  return { start: first.getTime(), end: addDays(lastDay, 1).getTime() };
}

/**
 * Свободные окна одного дня внутри [dayStart, dayEnd]:
 *  - занятые интервалы могут пересекаться — сливаются;
 *  - окна короче minMinutes отбрасываются;
 *  - для сегодняшнего дня окно начинается не раньше текущего момента (округлён вверх до минуты).
 */
export function freeWindowsForDay(opts: {
  date: string;
  dayStart: string;
  dayEnd: string;
  minMinutes: number;
  busy: BusyInterval[];
  now: Date;
}): FreeWindow[] {
  const { date, minMinutes, busy } = opts;
  const windowEnd = localMs(date, opts.dayEnd);
  let cursor = localMs(date, opts.dayStart);
  const nowMs = Math.ceil(opts.now.getTime() / 60_000) * 60_000;
  if (nowMs >= windowEnd || windowEnd <= cursor) return [];
  cursor = Math.max(cursor, nowMs);

  const clipped = busy
    .map((b) => ({ start: Math.max(b.start, cursor), end: Math.min(b.end, windowEnd) }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);

  const out: FreeWindow[] = [];
  const push = (from: number, to: number) => {
    const minutes = Math.round((to - from) / 60_000);
    if (minutes >= minMinutes && minutes > 0) {
      out.push({ start: format(from, "HH:mm"), end: format(to, "HH:mm"), minutes });
    }
  };
  for (const b of clipped) {
    if (b.start > cursor) push(cursor, b.start);
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < windowEnd) push(cursor, windowEnd);
  return out;
}

/** Все даты YYYY-MM-DD от `from` до `to` включительно. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = parseISO(from); format(d, "yyyy-MM-dd") <= to; d = addDays(d, 1)) out.push(format(d, "yyyy-MM-dd"));
  return out;
}
