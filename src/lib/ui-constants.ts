import type { Bucket, EventType, ProjectType } from "@/shared/schemas";

export const ACCENT_COLORS = ["#2e5eff", "#7b5cff", "#1fae6b", "#f08c3a", "#e5484d", "#0fa3a3"] as const;

/** Палитра для проектов и категорий. */
export const PALETTE = [...ACCENT_COLORS, "#9a9da4", "#d6409f"] as const;

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  meeting: "#2e5eff",
  sport: "#1fae6b",
  personal: "#f08c3a",
  focus: "#7b5cff",
  other: "#9a9da4",
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  meeting: "Встреча",
  sport: "Спорт",
  personal: "Личное",
  focus: "Фокус",
  other: "Другое",
};

export const BUCKET_LABELS: Record<Bucket, string> = {
  inbox: "Входящие",
  today: "Сегодня",
  week: "Неделя",
  later: "Потом",
};

export const PRIORITY_LABELS = ["Нет", "Низкий", "Средний", "Высокий"] as const;

export const PROJECT_TYPE_INFO: Record<ProjectType, { label: string; description: string; emoji: string }> = {
  project: { label: "Проект", description: "Доска задач: Бэклог, В работе, Готово", emoji: "📋" },
  trip: { label: "Поездка", description: "Маршрут, брони и сборы в одном месте", emoji: "✈️" },
  content: { label: "Контент", description: "От идеи и сценария до съёмки и публикации", emoji: "🎬" },
  learning: { label: "Обучение", description: "Модули и прогресс по изучению темы", emoji: "📚" },
};
