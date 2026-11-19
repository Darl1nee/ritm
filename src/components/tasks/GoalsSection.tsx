"use client";
import { useState } from "react";
import clsx from "clsx";
import { ChevronDown, Flag, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useQuickCreate } from "@/components/shell";
import { useCategories, useGoals, useTasks, type Goal } from "@/lib/queries";
import { TaskItem } from "./TaskItem";
import { shortDate } from "./task-utils";

function GoalTasks({ goal, onOpen }: { goal: Goal; onOpen: (id: string) => void }) {
  const { open } = useQuickCreate();
  const { data, isLoading } = useTasks({ goal_id: goal.id });
  const tasks = (data ?? []).filter((t) => t.parent_id === null);
  return (
    <div className="anim-fade mt-4 border-t border-line pt-3">
      {isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : tasks.length === 0 ? (
        <p className="px-2.5 py-2 text-sm text-fg-sub">К цели пока не привязано задач</p>
      ) : (
        tasks.map((t) => <TaskItem key={t.id} task={t} onOpen={onOpen} compact />)
      )}
      <button
        type="button"
        onClick={() => open("task", { goal_id: goal.id })}
        className="mt-1 flex h-9 w-full items-center gap-3 rounded-2xl px-2.5 text-sm text-fg-sub transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <Plus size={18} className="mx-0.5" />
        Задача к цели
      </button>
    </div>
  );
}

function GoalCard({ goal, onOpen }: { goal: Goal; onOpen: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const { data: categories } = useCategories();
  const color = categories?.find((c) => c.id === goal.category_id)?.color;
  const { done, total, percent } = goal.progress;
  return (
    <Card className="self-start">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="block w-full text-left"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold">{goal.title}</div>
            <div className="mt-0.5 text-[12px] text-fg-sub">
              {goal.target_date ? `до ${shortDate(goal.target_date)}` : "Без срока"}
            </div>
          </div>
          <ChevronDown
            size={18}
            className={clsx("mt-0.5 shrink-0 text-fg-sub transition-transform duration-200", expanded && "rotate-180")}
          />
        </div>
        <ProgressBar value={percent} color={color} className="mt-4" />
        <div className="mt-2 flex justify-between text-[12px] tabular-nums text-fg-sub">
          <span>
            {done} из {total} задач
          </span>
          <span>{percent}%</span>
        </div>
      </button>
      {expanded && <GoalTasks goal={goal} onOpen={onOpen} />}
    </Card>
  );
}

export function GoalsSection({ onOpen }: { onOpen: (id: string) => void }) {
  const { open } = useQuickCreate();
  const { data, isLoading } = useGoals();
  const goals = (data ?? []).filter((g) => g.status === "active");
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[20px] font-bold">
          <Flag size={18} className="text-fg-sub" />
          Цели
        </h2>
        {goals.length > 0 && (
          <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => open("goal")}>
            Новая цель
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-card" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <EmptyState text="Поставьте первую цель" onClick={() => open("goal")} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}
