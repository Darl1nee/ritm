import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { format, formatISO, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { eq } from "drizzle-orm";
import { ZodError, type z } from "zod";
import type { Db } from "@/server/db/factory";
import { categories } from "@/server/db/schema";
import type { McpToken } from "@/server/services/mcp-tokens";
import { logActivity, snapshotEntity, type ActivityAction, type EntityType } from "@/server/services/activity";
import { NotFoundError } from "@/server/services/common";
import { hasAllScopes, requireScopes, ScopeError, type Scope } from "../scopes";

export interface ToolCtx {
  server: McpServer;
  db: Db;
  token: McpToken;
  now: () => Date;
}

type ToolKind = "read" | "write" | "destructive";

export interface ToolDef<S extends z.ZodRawShape> {
  name: string;
  title: string;
  description: string;
  /** Нужны ВСЕ перечисленные права. Пустой список — инструмент без прав. */
  scopes: Scope[];
  /** Альтернатива: достаточно любого одного из этих прав (для search). */
  anyOf?: Scope[];
  kind: ToolKind;
  input?: S;
  run: (args: z.infer<z.ZodObject<S>>) => unknown | Promise<unknown>;
}

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

export const ok = (data: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data) }],
});

export const fail = (message: string): ToolResult => ({
  isError: true,
  content: [{ type: "text", text: message }],
});

/** Понятное сообщение для ожидаемых ошибок; для остальных — null (внутренняя ошибка). */
export function errorMessage(e: unknown): string | null {
  if (e instanceof ZodError) {
    return (
      "Неверные параметры: " +
      e.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message).join("; ")
    );
  }
  if (e instanceof ScopeError || e instanceof NotFoundError || e instanceof RangeError) return e.message;
  return null;
}

/**
 * Регистрирует инструмент, только если у ключа хватает прав (агент не видит лишнего).
 * Внутри обработчика права проверяются ещё раз; ожидаемые ошибки уходят как `isError`.
 */
export function defineTool<S extends z.ZodRawShape = Record<string, never>>(ctx: ToolCtx, def: ToolDef<S>): void {
  const granted = ctx.token.scopes;
  const allowed = (g: readonly Scope[]) =>
    hasAllScopes(g, def.scopes) && (!def.anyOf || def.anyOf.some((s) => g.includes(s)));
  if (!allowed(granted)) return;

  const annotations =
    def.kind === "read"
      ? { title: def.title, readOnlyHint: true, openWorldHint: false }
      : def.kind === "destructive"
        ? { title: def.title, readOnlyHint: false, destructiveHint: true, openWorldHint: false }
        : { title: def.title, readOnlyHint: false, destructiveHint: false, openWorldHint: false };

  const handler = async (args: z.infer<z.ZodObject<S>>): Promise<ToolResult> => {
    try {
      requireScopes(ctx.token.scopes, def.scopes);
      if (def.anyOf && !def.anyOf.some((s) => ctx.token.scopes.includes(s))) throw new ScopeError(def.anyOf);
      return ok(await def.run(args));
    } catch (e) {
      const msg = errorMessage(e);
      if (msg !== null) return fail(msg);
      console.error(`[mcp] ${def.name}:`, e);
      return fail("Внутренняя ошибка сервера");
    }
  };

  ctx.server.registerTool(
    def.name,
    { title: def.title, description: def.description, inputSchema: (def.input ?? {}) as z.ZodRawShape, annotations } as never,
    handler as never,
  );
}

/** Запись + журнал в одной транзакции. */
export async function write<T>(ctx: ToolCtx, fn: (tx: Db) => Promise<T>): Promise<T> {
  return await ctx.db.transaction(async (tx) => await fn(tx as unknown as Db));
}

export async function log(
  tx: Db,
  ctx: ToolCtx,
  tool: string,
  entity_type: EntityType,
  entity_id: string,
  action: ActivityAction,
  summary: string,
  before?: unknown,
  after?: unknown,
): Promise<void> {
  await logActivity(tx, { token_id: ctx.token.id, tool, entity_type, entity_id, action, summary, before, after }, ctx.now());
}

export const q = (s: string) => `«${s}»`;

/** «20 нояб» */
export function ruShortDate(date: string): string {
  return format(parseISO(date), "d MMM", { locale: ru }).replace(/\.$/, "");
}

/** Убирает null / undefined / пустые строки — результат компактнее для агента. */
export function compact<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== ""),
  ) as Partial<T>;
}

/** ISO-момент в локальном часовом поясе сервера с явным смещением. */
export const localIso = (iso: string) => formatISO(new Date(iso));

export function limitOf(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? 50, 1), 200);
}

export function must<T>(v: T | null | undefined, what: string): T {
  if (v === null || v === undefined) throw new NotFoundError(what);
  return v;
}

/** Проверяет, что связанные сущности существуют (иначе агент получил бы «осиротевший» id). */
export async function checkRefs(
  db: Db,
  refs: {
    project_id?: string | null;
    category_id?: string | null;
    goal_id?: string | null;
    section_id?: string | null;
    parent_id?: string | null;
  },
): Promise<void> {
  if (refs.project_id && !(await snapshotEntity(db, "project", refs.project_id))) throw new NotFoundError("Проект");
  if (refs.goal_id && !(await snapshotEntity(db, "goal", refs.goal_id))) throw new NotFoundError("Цель");
  if (refs.section_id && !(await snapshotEntity(db, "section", refs.section_id))) throw new NotFoundError("Колонка");
  if (refs.parent_id && !(await snapshotEntity(db, "task", refs.parent_id))) throw new NotFoundError("Родительская задача");
  if (refs.category_id) {
    const c = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, refs.category_id)).get();
    if (!c) throw new NotFoundError("Категория");
  }
}
