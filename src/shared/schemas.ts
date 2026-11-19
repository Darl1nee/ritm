import { z } from "zod";

// ---------- примитивы ----------
export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ожидается YYYY-MM-DD");
export const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Ожидается HH:MM");
export const isoDateTime = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "Ожидается ISO-дата и время");
export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Ожидается цвет #rrggbb");

export const BUCKETS = ["inbox", "today", "week", "later"] as const;
export const PROJECT_TYPES = ["project", "trip", "content", "learning"] as const;
export const PROJECT_STATUSES = ["active", "paused", "done", "archived"] as const;
export const GOAL_STATUSES = ["active", "done", "archived"] as const;
export const EVENT_TYPES = ["meeting", "sport", "personal", "focus", "other"] as const;
export const NOTE_KINDS = ["note", "idea"] as const;
export const TASK_VIEWS = ["today", "week", "later", "inbox", "all"] as const;

export const bucketSchema = z.enum(BUCKETS);
export const projectTypeSchema = z.enum(PROJECT_TYPES);
export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export const goalStatusSchema = z.enum(GOAL_STATUSES);
export const eventTypeSchema = z.enum(EVENT_TYPES);
export const noteKindSchema = z.enum(NOTE_KINDS);

/**
 * Схема частичного обновления: все поля optional, а значения по умолчанию
 * (`.default()`) снимаются — иначе zod 4 подставит их в PATCH и затрёт данные.
 */
function patch<T extends z.ZodObject>(schema: T): z.ZodType<Partial<z.input<T>>> {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, field] of Object.entries(schema.shape) as [string, z.ZodType][]) {
    const inner = field instanceof z.ZodDefault ? (field.def.innerType as z.ZodType) : field;
    shape[key] = inner.optional();
  }
  return z.object(shape) as unknown as z.ZodType<Partial<z.input<T>>>;
}

// ---------- categories ----------
const categoryBase = z.object({
  name: z.string().trim().min(1),
  color: hexColor.default("#2e5eff"),
  sort: z.number().int().optional(),
});
export const categoryCreateSchema = categoryBase;
export const categoryUpdateSchema = patch(categoryBase);

// ---------- projects ----------
const projectBase = z.object({
  title: z.string().trim().min(1),
  type: projectTypeSchema.default("project"),
  status: projectStatusSchema.default("active"),
  description: z.string().default(""),
  color: hexColor.default("#2e5eff"),
  emoji: z.string().nullable().optional(),
  start_date: dateStr.nullable().optional(),
  due_date: dateStr.nullable().optional(),
});
export const projectCreateSchema = projectBase;
export const projectUpdateSchema = patch(projectBase);
export const projectFiltersSchema = z.object({
  type: projectTypeSchema.optional(),
  status: projectStatusSchema.optional(),
  q: z.string().optional(),
});

// ---------- sections ----------
const sectionBase = z.object({
  title: z.string().trim().min(1),
  sort: z.number().int().optional(),
});
export const sectionCreateSchema = sectionBase;
export const sectionUpdateSchema = patch(sectionBase);

// ---------- goals ----------
const goalBase = z.object({
  title: z.string().trim().min(1),
  description: z.string().default(""),
  target_date: dateStr.nullable().optional(),
  category_id: z.string().nullable().optional(),
  status: goalStatusSchema.default("active"),
});
export const goalCreateSchema = goalBase;
export const goalUpdateSchema = patch(goalBase);

// ---------- tasks ----------
const taskBase = z.object({
  title: z.string().trim().min(1),
  notes: z.string().default(""),
  done: z.boolean().default(false),
  bucket: bucketSchema.default("inbox"),
  due_date: dateStr.nullable().optional(),
  due_time: timeStr.nullable().optional(),
  duration_min: z.number().int().positive().nullable().optional(),
  priority: z.number().int().min(0).max(3).default(0),
  category_id: z.string().nullable().optional(),
  project_id: z.string().nullable().optional(),
  section_id: z.string().nullable().optional(),
  goal_id: z.string().nullable().optional(),
  parent_id: z.string().nullable().optional(),
  sort: z.number().int().optional(),
});
export const taskCreateSchema = taskBase;
export const taskUpdateSchema = patch(taskBase);

export const taskReorderSchema = z.array(
  z.object({
    id: z.string(),
    sort: z.number().int(),
    bucket: bucketSchema.optional(),
    section_id: z.string().nullable().optional(),
  }),
);

export const taskFiltersSchema = z.object({
  view: z.enum(TASK_VIEWS).optional(),
  project_id: z.string().optional(),
  category_id: z.string().optional(),
  goal_id: z.string().optional(),
  done: z.boolean().optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
});

// ---------- events ----------
const eventBase = z.object({
  title: z.string().trim().min(1),
  type: eventTypeSchema.default("other"),
  start_at: isoDateTime,
  end_at: isoDateTime,
  all_day: z.boolean().default(false),
  location: z.string().default(""),
  notes: z.string().default(""),
  project_id: z.string().nullable().optional(),
});
export const eventCreateSchema = eventBase.refine(
  (e) => Date.parse(e.end_at) >= Date.parse(e.start_at),
  { message: "end_at раньше start_at", path: ["end_at"] },
);
export const eventUpdateSchema = patch(eventBase);
export const eventRangeSchema = z.object({
  from: dateStr,
  to: dateStr,
});

// ---------- notes ----------
const noteBase = z.object({
  title: z.string().default(""),
  body: z.string().default(""),
  kind: noteKindSchema.default("note"),
  project_id: z.string().nullable().optional(),
  pinned: z.boolean().default(false),
});
export const noteCreateSchema = noteBase;
export const noteUpdateSchema = patch(noteBase);
export const noteFiltersSchema = z.object({
  kind: noteKindSchema.optional(),
  q: z.string().optional(),
  project_id: z.string().optional(),
});

// ---------- focus ----------
export const focusCreateSchema = z.object({
  started_at: isoDateTime,
  ended_at: isoDateTime,
  duration_min: z.number().int().positive(),
  task_id: z.string().nullable().optional(),
});

// ---------- settings ----------
export const themeSchema = z.enum(["light", "dark", "system"]);
export const settingsSchema = z.object({
  theme: themeSchema,
  accent: hexColor,
  focus_goal_min: z.number().int().positive(),
  focus_length_min: z.number().int().positive(),
  user_name: z.string(),
});
export const settingsUpdateSchema = settingsSchema.partial(); // без default-ов — partial безопасен
export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  accent: "#2e5eff",
  focus_goal_min: 120,
  focus_length_min: 25,
  user_name: "Рамазан",
};

// ---------- search ----------
export const searchSchema = z.object({ q: z.string().trim().default("") });

// ---------- типы ----------
export type Bucket = z.infer<typeof bucketSchema>;
export type ProjectType = z.infer<typeof projectTypeSchema>;
export type EventType = z.infer<typeof eventTypeSchema>;
export type CategoryCreate = z.input<typeof categoryCreateSchema>;
export type CategoryUpdate = z.infer<typeof categoryUpdateSchema>;
export type ProjectCreate = z.input<typeof projectCreateSchema>;
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;
export type ProjectFilters = z.infer<typeof projectFiltersSchema>;
export type SectionCreate = z.input<typeof sectionCreateSchema>;
export type SectionUpdate = z.infer<typeof sectionUpdateSchema>;
export type GoalCreate = z.input<typeof goalCreateSchema>;
export type GoalUpdate = z.infer<typeof goalUpdateSchema>;
export type TaskCreate = z.input<typeof taskCreateSchema>;
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;
export type TaskReorder = z.infer<typeof taskReorderSchema>;
export type TaskFilters = z.infer<typeof taskFiltersSchema>;
export type EventCreate = z.input<typeof eventCreateSchema>;
export type EventUpdate = z.infer<typeof eventUpdateSchema>;
export type EventRange = z.infer<typeof eventRangeSchema>;
export type NoteCreate = z.input<typeof noteCreateSchema>;
export type NoteUpdate = z.infer<typeof noteUpdateSchema>;
export type NoteFilters = z.infer<typeof noteFiltersSchema>;
export type FocusCreate = z.input<typeof focusCreateSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
