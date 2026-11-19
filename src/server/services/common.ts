import { nanoid } from "nanoid";
import { format } from "date-fns";

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what}: не найдено`);
    this.name = "NotFoundError";
  }
}

export const newId = () => nanoid(12);
export const nowIso = (now: Date = new Date()) => now.toISOString();

/** Нормализует ISO-момент к UTC (чтобы строки сравнивались лексикографически). */
export const toUtcIso = (s: string) => new Date(s).toISOString();

/** Локальная дата YYYY-MM-DD для ISO-момента. */
export const localDate = (iso: string) => format(new Date(iso), "yyyy-MM-dd");

/** Границы суток [from 00:00, to 24:00) локального времени в UTC ISO. */
export function rangeToIso(from: string, to: string): { start: string; end: string } {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Убирает undefined, чтобы patch не затирал поля. */
export function clean<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Регистронезависимый (в т.ч. кириллица) поиск подстроки. */
export function matches(q: string, ...fields: (string | null | undefined)[]): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(needle));
}
