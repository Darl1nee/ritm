import { addDays, format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { bucketOf, todayStr } from "@/shared/dates";
import type { Bucket, TaskUpdate } from "@/shared/schemas";
import type { Task } from "@/lib/queries";

export type GroupKey = "today" | "week" | "later" | "inbox";
export const GROUP_KEYS: GroupKey[] = ["today", "week", "later", "inbox"];

export const GROUP_META: Record<GroupKey, { title: string; color: string; empty: string }> = {
  today: { title: "Сегодня", color: "var(--danger)", empty: "На сегодня всё чисто" },
  week: { title: "На неделе", color: "var(--accent)", empty: "Ничего не запланировано на неделю" },
  later: { title: "Потом", color: "var(--fg-sub)", empty: "Здесь живут задачи «когда-нибудь»" },
  inbox: { title: "Входящие", color: "#8e5cf7", empty: "Входящие пусты" },
};

export const PRIORITY_COLORS = ["", "#2e5eff", "#f08c3a", "#e5484d"] as const;

/** Короткая дата без точки: «18 нояб». */
export function shortDate(date: string): string {
  return format(parseISO(date), "d MMM", { locale: ru }).replace(/\.$/, "");
}

/** «сегодня» / «завтра» / «вчера» / «18 нояб». */
export function relativeDate(date: string, now: Date = new Date()): string {
  const today = todayStr(now);
  if (date === today) return "сегодня";
  if (date === todayStr(addDays(now, 1))) return "завтра";
  if (date === todayStr(addDays(now, -1))) return "вчера";
  return shortDate(date);
}

/**
 * Патч задачи для переноса в бакет. Для «Сегодня» просто ставим bucket=today.
 * Для остальных — если due_date всё ещё затягивает задачу в другую группу, сбрасываем его.
 */
export function bucketPatch(task: Task, bucket: GroupKey | Bucket): TaskUpdate {
  const patch: TaskUpdate = { bucket };
  if (bucket === "today") return patch;
  const probe = { ...task, done: false, bucket: bucket as Bucket };
  if (task.due_date !== null && bucketOf(probe) !== bucket) patch.due_date = null;
  return patch;
}
