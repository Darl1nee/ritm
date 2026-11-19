import { z } from "zod";
import { GOAL_STATUSES, dateStr, goalCreateSchema, goalUpdateSchema } from "@/shared/schemas";
import { createGoal, getGoal, listGoals, updateGoal, type Goal } from "@/server/services/goals";
import { markAgent, snapshotEntity } from "@/server/services/activity";
import { checkRefs, compact, defineTool, log, must, q, write, type ToolCtx } from "./common";

function compactGoal(g: Goal) {
  return compact({
    id: g.id,
    title: g.title,
    description: g.description,
    target_date: g.target_date,
    category_id: g.category_id,
    status: g.status,
    progress: g.progress,
  });
}

export function registerGoalTools(ctx: ToolCtx) {
  const { db } = ctx;

  defineTool(ctx, {
    name: "list_goals",
    title: "Список целей",
    description: "Цели с прогрессом (по привязанным задачам). Можно отфильтровать по статусу.",
    scopes: ["goals:read"],
    kind: "read",
    input: { status: z.enum(GOAL_STATUSES).optional().describe("active, done или archived") },
    run: async ({ status }) => (await listGoals(db)).filter((g) => !status || g.status === status).map(compactGoal),
  });

  defineTool(ctx, {
    name: "create_goal",
    title: "Создать цель",
    description: "Создаёт цель. Задачи к ней привязываются через goal_id в create_task / update_task.",
    scopes: ["goals:write"],
    kind: "write",
    input: {
      title: z.string().describe("Название цели"),
      description: z.string().optional().describe("Описание"),
      target_date: dateStr.optional().describe("Желаемая дата достижения, YYYY-MM-DD"),
      category_id: z.string().optional().describe("id категории"),
    },
    run: async (raw) => {
      const input = goalCreateSchema.parse(raw);
      return await write(ctx, async (tx) => {
        await checkRefs(tx, input);
        const g = await createGoal(tx, input);
        await markAgent(tx, "goal", g.id);
        await log(tx, ctx, "create_goal", "goal", g.id, "create", `Создана цель ${q(g.title)}`, undefined, await snapshotEntity(tx, "goal", g.id));
        return compactGoal(await getGoal(tx, g.id));
      });
    },
  });

  defineTool(ctx, {
    name: "update_goal",
    title: "Изменить цель",
    description: "Меняет поля цели, в том числе статус (active, done, archived). Передавайте только изменяемое.",
    scopes: ["goals:write"],
    kind: "write",
    input: {
      id: z.string().describe("id цели"),
      title: z.string().optional().describe("Новое название"),
      description: z.string().optional().describe("Описание"),
      target_date: dateStr.nullable().optional().describe("Дата; null — очистить"),
      category_id: z.string().nullable().optional().describe("id категории; null — очистить"),
      status: z.enum(GOAL_STATUSES).optional().describe("Статус цели"),
    },
    run: async ({ id, ...raw }) => {
      const patch = goalUpdateSchema.parse(raw);
      if (!Object.values(patch).some((v) => v !== undefined)) throw new RangeError("Не указано ни одного поля для изменения");
      return await write(ctx, async (tx) => {
        const before = must(await snapshotEntity(tx, "goal", id), "Цель");
        await checkRefs(tx, patch);
        await updateGoal(tx, id, patch);
        const after = await snapshotEntity(tx, "goal", id);
        await log(tx, ctx, "update_goal", "goal", id, "update", `Изменена цель ${q(String(after?.title))}`, before, after);
        return compactGoal(await getGoal(tx, id));
      });
    },
  });
}
