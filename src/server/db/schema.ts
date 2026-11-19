import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const timestamps = {
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
};

export const categories = sqliteTable("categories", {
  id: id(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  sort: integer("sort").notNull().default(0),
  ...timestamps,
});

export const projects = sqliteTable("projects", {
  id: id(),
  title: text("title").notNull(),
  type: text("type", { enum: ["project", "trip", "content", "learning"] })
    .notNull()
    .default("project"),
  status: text("status", { enum: ["active", "paused", "done", "archived"] })
    .notNull()
    .default("active"),
  description: text("description").notNull().default(""),
  color: text("color").notNull().default("#2e5eff"),
  emoji: text("emoji"),
  start_date: text("start_date"),
  due_date: text("due_date"),
  source: text("source", { enum: ["user", "agent"] }).notNull().default("user"),
  ...timestamps,
});

export const project_sections = sqliteTable(
  "project_sections",
  {
    id: id(),
    project_id: text("project_id").notNull(),
    title: text("title").notNull(),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("project_sections_project_idx").on(t.project_id)],
);

export const goals = sqliteTable("goals", {
  id: id(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  target_date: text("target_date"),
  category_id: text("category_id"),
  status: text("status", { enum: ["active", "done", "archived"] })
    .notNull()
    .default("active"),
  source: text("source", { enum: ["user", "agent"] }).notNull().default("user"),
  ...timestamps,
});

export const tasks = sqliteTable(
  "tasks",
  {
    id: id(),
    title: text("title").notNull(),
    notes: text("notes").notNull().default(""),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    completed_at: text("completed_at"),
    bucket: text("bucket", { enum: ["inbox", "today", "week", "later"] })
      .notNull()
      .default("inbox"),
    due_date: text("due_date"),
    due_time: text("due_time"),
    duration_min: integer("duration_min"),
    priority: integer("priority").notNull().default(0),
    category_id: text("category_id"),
    project_id: text("project_id"),
    section_id: text("section_id"),
    goal_id: text("goal_id"),
    parent_id: text("parent_id"),
    sort: integer("sort").notNull().default(0),
    source: text("source", { enum: ["user", "agent"] }).notNull().default("user"),
    ...timestamps,
  },
  (t) => [
    index("tasks_project_idx").on(t.project_id),
    index("tasks_parent_idx").on(t.parent_id),
    index("tasks_due_idx").on(t.due_date),
  ],
);

export const events = sqliteTable(
  "events",
  {
    id: id(),
    title: text("title").notNull(),
    type: text("type", {
      enum: ["meeting", "sport", "personal", "focus", "other"],
    })
      .notNull()
      .default("other"),
    start_at: text("start_at").notNull(),
    end_at: text("end_at").notNull(),
    all_day: integer("all_day", { mode: "boolean" }).notNull().default(false),
    location: text("location").notNull().default(""),
    notes: text("notes").notNull().default(""),
    project_id: text("project_id"),
    source: text("source", { enum: ["user", "agent"] }).notNull().default("user"),
    ...timestamps,
  },
  (t) => [index("events_start_idx").on(t.start_at)],
);

export const notes = sqliteTable("notes", {
  id: id(),
  title: text("title").notNull().default(""),
  body: text("body").notNull().default(""),
  kind: text("kind", { enum: ["note", "idea"] })
    .notNull()
    .default("note"),
  project_id: text("project_id"),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  source: text("source", { enum: ["user", "agent"] }).notNull().default("user"),
  ...timestamps,
});

export const focus_sessions = sqliteTable("focus_sessions", {
  id: id(),
  started_at: text("started_at").notNull(),
  ended_at: text("ended_at").notNull(),
  duration_min: integer("duration_min").notNull(),
  task_id: text("task_id"),
  ...timestamps,
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

/** Ключи доступа MCP. Храним только SHA-256 от ключа; сам ключ показывается один раз. */
export const mcp_tokens = sqliteTable(
  "mcp_tokens",
  {
    id: id(),
    name: text("name").notNull(),
    token_hash: text("token_hash").notNull(),
    prefix: text("prefix").notNull(), // первые символы ключа — для отображения
    scopes: text("scopes").notNull(), // JSON: string[] вида "tasks:read"
    last_used_at: text("last_used_at"),
    revoked_at: text("revoked_at"),
    ...timestamps,
  },
  (t) => [index("mcp_tokens_hash_idx").on(t.token_hash)],
);

/** Журнал действий ИИ-агентов (для просмотра и отмены). */
export const agent_activity = sqliteTable(
  "agent_activity",
  {
    id: id(),
    token_id: text("token_id"),
    tool: text("tool").notNull(),
    entity_type: text("entity_type", {
      enum: ["task", "project", "section", "event", "note", "goal"],
    }).notNull(),
    entity_id: text("entity_id").notNull(),
    action: text("action", { enum: ["create", "update", "delete"] }).notNull(),
    summary: text("summary").notNull(),
    before: text("before"), // JSON-снимок до изменения (update/delete)
    after: text("after"), // JSON-снимок после (create/update)
    undone_at: text("undone_at"),
    created_at: text("created_at").notNull(),
  },
  (t) => [index("agent_activity_created_idx").on(t.created_at)],
);

export type CategoryRow = typeof categories.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type SectionRow = typeof project_sections.$inferSelect;
export type GoalRow = typeof goals.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type NoteRow = typeof notes.$inferSelect;
export type FocusRow = typeof focus_sessions.$inferSelect;
export type McpTokenRow = typeof mcp_tokens.$inferSelect;
export type AgentActivityRow = typeof agent_activity.$inferSelect;
