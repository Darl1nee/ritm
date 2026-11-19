import type { PROJECT_STATUSES, ProjectType as PT } from "@/shared/schemas";

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectType = PT;

/** Подписи под тип проекта: как называть колонки и кнопку добавления. */
export const COLUMN_WORDS: Record<PT, { add: string; newTitle: string; rename: string; empty: string }> = {
  project: { add: "Колонка", newTitle: "Название колонки", rename: "Переименовать колонку", empty: "Пока пусто" },
  trip: { add: "Раздел", newTitle: "Название раздела", rename: "Переименовать раздел", empty: "Добавьте первое дело" },
  content: { add: "Этап", newTitle: "Название этапа", rename: "Переименовать этап", empty: "Пока пусто" },
  learning: { add: "Модуль", newTitle: "Название модуля", rename: "Переименовать модуль", empty: "Добавьте урок" },
};
