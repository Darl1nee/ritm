import { format, startOfWeek, endOfWeek } from "date-fns";
import type { Bucket } from "./schemas";

export type TaskBucketView = "today" | "week" | "later" | "inbox";

export interface BucketInput {
  done: boolean;
  bucket: Bucket;
  due_date: string | null;
  project_id: string | null;
}

/** Сегодняшняя дата локально, YYYY-MM-DD. */
export function todayStr(now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd");
}

/** Текущая неделя пн–вс: { from, to } в YYYY-MM-DD (обе границы включительно). */
export function weekRange(now: Date = new Date()): { from: string; to: string } {
  return {
    from: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    to: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
  };
}

/** Семь дат недели пн–вс. */
export function weekDays(now: Date = new Date()): string[] {
  const start = startOfWeek(now, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return format(d, "yyyy-MM-dd");
  });
}

/**
 * Бакет невыполненной задачи по правилам SPEC.
 * Для выполненных возвращает null.
 *  - today: bucket=today ИЛИ due_date <= сегодня (просроченные тоже)
 *  - week: не today И (bucket=week ИЛИ due_date в пределах текущей недели)
 *  - inbox: bucket=inbox, без due_date и без project_id
 *  - later: всё остальное
 */
export function bucketOf(task: BucketInput, now: Date = new Date()): TaskBucketView | null {
  if (task.done) return null;
  const today = todayStr(now);
  if (task.bucket === "today" || (task.due_date !== null && task.due_date <= today)) {
    return "today";
  }
  const { from, to } = weekRange(now);
  const dueInWeek = task.due_date !== null && task.due_date >= from && task.due_date <= to;
  if (task.bucket === "week" || dueInWeek) return "week";
  if (task.bucket === "inbox" && task.due_date === null && task.project_id === null) {
    return "inbox";
  }
  return "later";
}

/** Просрочена ли невыполненная задача. */
export function isOverdue(task: Pick<BucketInput, "done" | "due_date">, now: Date = new Date()): boolean {
  return !task.done && task.due_date !== null && task.due_date < todayStr(now);
}
