import type { Db } from "../db/factory";
import { tasks as tasksTable } from "../db/schema";
import { todayStr, weekDays } from "@/shared/dates";
import { listEvents, type CalendarEvent } from "./events";
import { focusToday, type FocusToday } from "./focus";
import { listProjects, type Project } from "./projects";
import { getSettings } from "./settings";
import { listTasks, type Task } from "./tasks";
import { localDate, nowIso } from "./common";

export interface DayLoad {
  date: string;
  tasks_done: number;
  tasks_open: number;
  events: number;
  events_min: number;
}

export interface Overview {
  now: string;
  date: string;
  user_name: string;
  tasks_today: {
    /** Выполнено сегодня. */
    done: number;
    /** Выполнено сегодня + осталось на сегодня. */
    total: number;
    overdue: number;
    /** Невыполненные «сегодняшние» задачи (просроченные первыми). */
    items: Task[];
  };
  focus: FocusToday;
  /** События сегодня, которые ещё не закончились. */
  events_today: CalendarEvent[];
  week: DayLoad[];
  projects: Project[];
}

export async function getOverview(db: Db, now: Date = new Date()): Promise<Overview> {
  const date = todayStr(now);
  const days = weekDays(now);

  const [open, doneAllTasks, allTopRows, weekEvents, eventsToday, focus, projects, settings] = await Promise.all([
    listTasks(db, { view: "today" }, now),
    listTasks(db, { done: true }, now),
    db.select().from(tasksTable).all(),
    listEvents(db, { from: days[0], to: days[6] }),
    listEvents(db, { from: date, to: date }),
    focusToday(db, now),
    listProjects(db, { status: "active" }),
    getSettings(db),
  ]);

  const doneAll = doneAllTasks.filter((t) => t.parent_id === null);
  const doneToday = doneAll.filter((t) => t.completed_at && localDate(t.completed_at) === date);
  const items = [...open].sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      (a.due_time ?? "99:99").localeCompare(b.due_time ?? "99:99") ||
      b.priority - a.priority,
  );

  // Нагрузка по дням недели: задачи верхнего уровня по due_date
  // (без даты — выполненные по дню завершения, «сегодняшние» невыполненные — на сегодня).
  const allTop = allTopRows.filter((t) => t.parent_id === null);
  const dayOfTask = (t: (typeof allTop)[number]): string | null =>
    t.due_date ?? (t.done && t.completed_at ? localDate(t.completed_at) : t.bucket === "today" ? date : null);

  const week: DayLoad[] = days.map((d) => {
    const dayTasks = allTop.filter((t) => dayOfTask(t) === d);
    const dayEvents = weekEvents.filter((e) => localDate(e.start_at) === d);
    return {
      date: d,
      tasks_done: dayTasks.filter((t) => t.done).length,
      tasks_open: dayTasks.filter((t) => !t.done).length,
      events: dayEvents.length,
      events_min: dayEvents
        .filter((e) => !e.all_day)
        .reduce((s, e) => s + Math.max(0, Math.round((Date.parse(e.end_at) - Date.parse(e.start_at)) / 60000)), 0),
    };
  });

  const nowMs = now.getTime();
  const events_today = eventsToday.filter(
    (e) => e.all_day || Date.parse(e.end_at) >= nowMs,
  );

  return {
    now: nowIso(now),
    date,
    user_name: settings.user_name,
    tasks_today: {
      done: doneToday.length,
      total: doneToday.length + open.length,
      overdue: open.filter((t) => t.overdue).length,
      items,
    },
    focus,
    events_today,
    week,
    projects,
  };
}
