import { format } from "date-fns";
import { eq } from "drizzle-orm";
import type { Db } from "./factory";
import {
  categories,
  events,
  focus_sessions,
  goals,
  notes,
  project_sections,
  projects,
  tasks,
  agent_activity,
} from "./schema";
import { weekDays } from "@/shared/dates";
import { DEFAULT_SETTINGS, type TaskCreate } from "@/shared/schemas";
import { createCategory } from "../services/categories";
import { createEvent } from "../services/events";
import { createFocus } from "../services/focus";
import { createGoal } from "../services/goals";
import { createNote } from "../services/notes";
import { createProject } from "../services/projects";
import { setSetting } from "../services/settings";
import { createTask } from "../services/tasks";

/** Заполняет БД демо-данными (даты относительно `now`). Идемпотентно. */
export async function seed(db: Db, now: Date = new Date()): Promise<void> {
  const day = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return format(d, "yyyy-MM-dd");
  };
  /** Локальное "YYYY-MM-DD HH:mm" → ISO UTC. */
  const at = (date: string, time: string) => new Date(`${date}T${time}:00`).toISOString();
  const today = day(0);
  const week = weekDays(now); // пн–вс

  // --- очистка (settings не трогаем) ---
  await db.delete(agent_activity).run(); // журнал ссылается на удаляемые сущности; ключи MCP не трогаем
  await db.delete(focus_sessions).run();
  await db.delete(tasks).run();
  await db.delete(project_sections).run();
  await db.delete(projects).run();
  await db.delete(goals).run();
  await db.delete(notes).run();
  await db.delete(events).run();
  await db.delete(categories).run();

  // --- настройки (upsert) ---
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    await setSetting(db, k, v);
  }

  // --- категории ---
  const catDefs = [
    ["Работа", "#2e5eff"],
    ["Личное", "#f08c3a"],
    ["Деньги", "#1fae6b"],
    ["Здоровье", "#e5484d"],
    ["Учёба", "#8e5cf7"],
  ] as const;
  const cats = [];
  for (let i = 0; i < catDefs.length; i++) {
    const [name, color] = catDefs[i];
    cats.push(await createCategory(db, { name, color, sort: i }));
  }
  const [work, personal, money, health, study] = cats;

  // --- проекты ---
  const course = await createProject(
    db,
    {
      title: "Запуск курса",
      type: "content",
      description: "Записать, смонтировать и опубликовать первый курс.",
      color: "#2e5eff",
      emoji: "🎬",
      start_date: day(-7),
      due_date: day(21),
    },
    now,
  );
  const trip = await createProject(
    db,
    {
      title: "Поездка в Казань",
      type: "trip",
      description: "Три дня в Казани: билеты, отель, маршрут.",
      color: "#f08c3a",
      emoji: "✈️",
      start_date: day(-3),
      due_date: day(30),
    },
    now,
  );
  const montage = await createProject(
    db,
    {
      title: "Курс по монтажу",
      type: "learning",
      description: "Проходим курс по монтажу: три модуля.",
      color: "#8e5cf7",
      emoji: "🎞️",
      start_date: day(-14),
      due_date: day(25),
    },
    now,
  );
  const sec = (p: typeof course, title: string) => p.sections.find((s) => s.title === title)!.id;

  // --- цели ---
  const goalCourse = await createGoal(db, {
    title: "Запустить курс до конца месяца",
    description: "Первые продажи и 30 учеников.",
    target_date: day(21),
    category_id: work.id,
  });
  const goalRun = await createGoal(db, {
    title: "Бегать три раза в неделю",
    description: "Держать ритм минимум месяц.",
    target_date: day(30),
    category_id: health.id,
  });

  // --- задачи ---
  const mk = async (input: TaskCreate, completedAt?: string) => {
    const t = await createTask(db, input, now);
    if (completedAt) await db.update(tasks).set({ completed_at: completedAt }).where(eq(tasks.id, t.id)).run();
    return t;
  };
  const yesterdayNoon = at(day(-1), "12:00");
  const todayMorning = at(today, "08:30");

  const lesson = await mk({
    title: "Записать вводный урок",
    notes: "Свет у окна, микрофон-петличка. Тезисы в заметке «Структура курса».",
    bucket: "today",
    due_date: today,
    due_time: "10:00",
    duration_min: 90,
    priority: 3,
    category_id: work.id,
    project_id: course.id,
    section_id: sec(course, "Съёмка"),
    goal_id: goalCourse.id,
  });
  await mk({
    title: "Смонтировать трейлер курса",
    bucket: "week",
    due_date: day(2),
    duration_min: 120,
    priority: 2,
    category_id: work.id,
    project_id: course.id,
    section_id: sec(course, "Монтаж"),
    goal_id: goalCourse.id,
  });
  const script = await mk(
    {
      title: "Написать сценарий модуля 1",
      done: true,
      bucket: "week",
      due_date: day(-1),
      priority: 2,
      category_id: work.id,
      project_id: course.id,
      section_id: sec(course, "Сценарий"),
      goal_id: goalCourse.id,
    },
    yesterdayNoon,
  );
  await mk({ title: "Структура модуля", done: true, parent_id: script.id, bucket: "week" }, yesterdayNoon);
  await mk({ title: "Тексты уроков", done: true, parent_id: script.id, bucket: "week" }, yesterdayNoon);
  await mk({ title: "Вычитать сценарий", parent_id: script.id, bucket: "week" });
  await mk({
    title: "Придумать обложку курса",
    bucket: "later",
    priority: 1,
    category_id: work.id,
    project_id: course.id,
    section_id: sec(course, "Идеи"),
  });
  await mk({
    title: "Оплатить хостинг",
    bucket: "today",
    due_date: day(-2),
    priority: 2,
    category_id: money.id,
  });
  await mk({
    title: "Купить билеты в Казань",
    bucket: "today",
    due_date: today,
    due_time: "18:00",
    priority: 2,
    category_id: personal.id,
    project_id: trip.id,
    section_id: sec(trip, "Брони"),
  });
  await mk({
    title: "Забронировать отель",
    bucket: "week",
    due_date: day(3),
    category_id: personal.id,
    project_id: trip.id,
    section_id: sec(trip, "Брони"),
  });
  await mk(
    {
      title: "Составить маршрут по городу",
      done: true,
      bucket: "week",
      category_id: personal.id,
      project_id: trip.id,
      section_id: sec(trip, "Маршрут"),
    },
    yesterdayNoon,
  );
  await mk({
    title: "Собрать чемодан",
    bucket: "later",
    due_date: day(29),
    category_id: personal.id,
    project_id: trip.id,
    section_id: sec(trip, "Сборы"),
  });
  await mk({
    title: "Тренировка",
    bucket: "today",
    due_date: today,
    due_time: "19:30",
    duration_min: 60,
    priority: 1,
    category_id: health.id,
    goal_id: goalRun.id,
  });
  await mk(
    {
      title: "Пробежка 5 км",
      done: true,
      bucket: "today",
      due_date: today,
      priority: 1,
      category_id: health.id,
      goal_id: goalRun.id,
    },
    todayMorning,
  );
  await mk({ title: "Позвонить маме", bucket: "inbox", category_id: personal.id });
  await mk({ title: "Идея для рилса про утренний ритуал", bucket: "inbox" });
  await mk(
    {
      title: "Модуль 1: основы монтажа",
      done: true,
      bucket: "week",
      category_id: study.id,
      project_id: montage.id,
      section_id: sec(montage, "Модуль 1"),
    },
    todayMorning,
  );
  await mk({
    title: "Модуль 2: цветокоррекция",
    bucket: "week",
    due_date: day(4),
    duration_min: 60,
    category_id: study.id,
    project_id: montage.id,
    section_id: sec(montage, "Модуль 2"),
  });
  await mk({
    title: "Модуль 3: работа со звуком",
    bucket: "later",
    category_id: study.id,
    project_id: montage.id,
    section_id: sec(montage, "Модуль 3"),
  });
  await mk({ title: "Прочитать главу про монтажные переходы", bucket: "week", due_date: day(1), category_id: study.id });
  const tax = await mk({
    title: "Налоговая декларация",
    bucket: "later",
    due_date: day(20),
    priority: 2,
    category_id: money.id,
  });
  await mk({ title: "Собрать справки", parent_id: tax.id, bucket: "later" });
  await mk({ title: "Заполнить форму", parent_id: tax.id, bucket: "later" });

  // --- события недели (пн–вс) ---
  const ev = (
    title: string,
    type: "meeting" | "sport" | "personal" | "focus" | "other",
    date: string,
    from: string,
    to: string,
    extra: { location?: string; all_day?: boolean; project_id?: string } = {},
  ) =>
    createEvent(db, {
      title,
      type,
      start_at: at(date, from),
      end_at: at(date, to),
      all_day: extra.all_day ?? false,
      location: extra.location ?? "",
      project_id: extra.project_id ?? null,
    });
  await ev("Планёрка", "meeting", week[0], "10:00", "11:00", { location: "Zoom" });
  await ev("Тренировка в зале", "sport", week[1], "19:00", "20:00", { location: "Фитнес-клуб" });
  await ev("Съёмка уроков", "focus", week[2], "12:00", "14:00", { project_id: course.id });
  await ev("Созвон с монтажёром", "meeting", today, "16:00", "16:30", { project_id: course.id });
  await ev("Обед с друзьями", "personal", week[3], "13:30", "15:00", { location: "Кофейня на Пятницкой" });
  await ev("Плавание", "sport", week[4], "08:00", "09:00", { location: "Бассейн" });
  await ev("День рождения Алины", "personal", week[5], "00:00", "23:59", { all_day: true });
  await ev("Планирование недели", "other", week[6], "20:00", "20:30");

  // --- заметки ---
  await createNote(db, {
    title: "Структура курса",
    kind: "note",
    pinned: true,
    project_id: course.id,
    body: "# Структура курса\n\n1. Вводный урок: зачем и для кого\n2. Модуль 1 — основы\n3. Модуль 2 — практика\n4. Итоговый проект\n\n**Важно:** каждый урок до 10 минут.",
  });
  await createNote(db, {
    title: "Список вещей в Казань",
    kind: "note",
    project_id: trip.id,
    body: "- паспорт\n- зарядки\n- лёгкая куртка\n- фотоаппарат",
  });
  await createNote(db, {
    title: "Серия рилсов про тихую роскошь",
    kind: "idea",
    body: "Пять коротких видео: детали, текстуры, утренний свет. Один и тот же приём монтажа.",
  });
  await createNote(db, {
    title: "Мини-курс по шортсам",
    kind: "idea",
    body: "Продать мини-курс как вход в основной: 3 урока по 5 минут.",
  });

  // --- фокус-сессии сегодня ---
  await createFocus(db, {
    started_at: at(today, "09:00"),
    ended_at: at(today, "09:25"),
    duration_min: 25,
    task_id: lesson.id,
  });
  await createFocus(db, {
    started_at: at(today, "09:35"),
    ended_at: at(today, "10:00"),
    duration_min: 25,
    task_id: null,
  });
}

// Запуск: `npm run db:seed`
if (typeof require !== "undefined" && require.main === module) {
  // динамический импорт — чтобы тесты, импортирующие seed, не открывали data/ritm.db
  import("./client").then(async ({ getDb }) => {
    await seed(getDb());
    console.log("Seed готов: data/ritm.db");
  });
}
