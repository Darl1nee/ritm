import { z } from "zod";
import { search } from "@/server/services/search";
import type { Scope } from "../scopes";
import { defineTool, type ToolCtx } from "./common";

const SEARCH_SCOPES: Record<string, Scope> = {
  task: "tasks:read",
  project: "projects:read",
  note: "notes:read",
  event: "calendar:read",
};

export function registerSearchTools(ctx: ToolCtx) {
  defineTool(ctx, {
    name: "search",
    title: "Поиск",
    description:
      "Поиск по задачам, проектам, заметкам и событиям — только по тем разделам, на чтение которых у ключа есть права. Используйте перед созданием, чтобы не плодить дубли.",
    scopes: [],
    anyOf: ["tasks:read", "projects:read", "notes:read", "calendar:read", "goals:read"],
    kind: "read",
    input: { q: z.string().describe("Что искать (подстрока, без учёта регистра)") },
    run: async ({ q }) => {
      const res = await search(ctx.db, q);
      return {
        query: res.query,
        results: res.results
          .filter((r) => ctx.token.scopes.includes(SEARCH_SCOPES[r.type]))
          .map((r) => ({ type: r.type, id: r.id, title: r.title, ...(r.subtitle ? { subtitle: r.subtitle } : {}) })),
      };
    },
  });
}
