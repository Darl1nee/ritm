import type { QueryClient } from "@tanstack/react-query";

/** Корневые ключи кэша. Ключ списка: [root, "list", filters], детали: [root, "detail", id]. */
export const keys = {
  tasks: ["tasks"] as const,
  projects: ["projects"] as const,
  goals: ["goals"] as const,
  events: ["events"] as const,
  notes: ["notes"] as const,
  categories: ["categories"] as const,
  focus: ["focus"] as const,
  settings: ["settings"] as const,
  overview: ["overview"] as const,
  search: ["search"] as const,
  mcp: ["mcp"] as const,
  activity: ["activity"] as const,
};

type Root = keyof typeof keys;

export function invalidate(qc: QueryClient, ...roots: Root[]) {
  return Promise.all(roots.map((r) => qc.invalidateQueries({ queryKey: keys[r] })));
}
