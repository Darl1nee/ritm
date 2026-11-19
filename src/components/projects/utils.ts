import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { isOverdue as overdue } from "@/shared/dates";
import type { ProjectStatus } from "./types";

/** «7 дек» — короткая дата без точки после месяца. */
export function shortDate(s: string): string {
  return format(parseISO(s), "d MMM", { locale: ru }).replace(".", "");
}

/** Мягкий фон из hex-цвета проекта. */
export function soft(color: string, alpha = "1f"): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}${alpha}` : "var(--surface-2)";
}

export function projectOverdue(p: { status: ProjectStatus; due_date: string | null }): boolean {
  return p.status !== "done" && p.status !== "archived" && overdue({ done: false, due_date: p.due_date });
}

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Активен",
  paused: "На паузе",
  done: "Завершён",
  archived: "Архив",
};

export const STATUS_TONE: Record<ProjectStatus, string> = {
  active: "bg-accent-soft text-accent",
  paused: "bg-[#f08c3a]/15 text-[#d9761f]",
  done: "bg-success/15 text-success",
  archived: "bg-surface-2 text-fg-sub",
};
