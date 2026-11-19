/**
 * Права доступа MCP-ключей: раздел × чтение/запись.
 * Запись не подразумевает чтение — каждое право выдаётся явно.
 */
export const SCOPE_GROUPS = {
  tasks: "Задачи и категории",
  projects: "Проекты и колонки",
  calendar: "Календарь",
  notes: "Заметки и идеи",
  goals: "Цели",
} as const;

export type ScopeGroup = keyof typeof SCOPE_GROUPS;
export type ScopeLevel = "read" | "write";
export type Scope = `${ScopeGroup}:${ScopeLevel}`;

export const ALL_SCOPES: Scope[] = (Object.keys(SCOPE_GROUPS) as ScopeGroup[]).flatMap((g) => [
  `${g}:read` as Scope,
  `${g}:write` as Scope,
]);

export const READ_ONLY_SCOPES: Scope[] = ALL_SCOPES.filter((s) => s.endsWith(":read"));

export function isScope(s: unknown): s is Scope {
  return typeof s === "string" && (ALL_SCOPES as string[]).includes(s);
}

/** Нормализует список: только известные права, без повторов, в каноническом порядке. */
export function normalizeScopes(input: readonly unknown[]): Scope[] {
  const set = new Set(input.filter(isScope));
  return ALL_SCOPES.filter((s) => set.has(s));
}

export function hasScope(granted: readonly Scope[], needed: Scope): boolean {
  return granted.includes(needed);
}

export function hasAllScopes(granted: readonly Scope[], needed: readonly Scope[]): boolean {
  return needed.every((s) => granted.includes(s));
}

export class ScopeError extends Error {
  constructor(public readonly missing: Scope[]) {
    super(`Недостаточно прав: нужно ${missing.join(", ")}. Выдайте права ключу в Настройках → Интеграции → MCP.`);
    this.name = "ScopeError";
  }
}

/** Бросает ScopeError, если каких-то прав не хватает. */
export function requireScopes(granted: readonly Scope[], needed: readonly Scope[]): void {
  const missing = needed.filter((s) => !granted.includes(s));
  if (missing.length) throw new ScopeError(missing);
}
