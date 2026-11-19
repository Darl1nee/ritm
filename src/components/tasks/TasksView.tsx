"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronRight, Flag, Plus } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useIsFetching } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CardHeader } from "@/components/ui/CardHeader";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useQuickCreate } from "@/components/shell";
import {
  keys,
  useCategories,
  useOverview,
  useReorderTasks,
  useTasks,
  useUpdateTask,
  type DayLoad,
  type Task,
} from "@/lib/queries";
import { todayStr } from "@/shared/dates";
import { GoalsSection } from "./GoalsSection";
import { TaskGroup } from "./TaskGroup";
import { TaskItem } from "./TaskItem";
import { TaskSheet } from "./TaskSheet";
import { GROUP_KEYS, bucketPatch, type GroupKey } from "./task-utils";

type Order = Record<GroupKey, string[]>;
const EMPTY_ORDER: Order = { today: [], week: [], later: [], inbox: [] };

export function TasksView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const { open: openCreate } = useQuickCreate();

  const categoryId = params.get("category");
  const taskParam = params.get("task");

  const setParam = useCallback(
    (key: string, value: string | null, mode: "push" | "replace" = "replace") => {
      const sp = new URLSearchParams(params.toString());
      if (value) sp.set(key, value);
      else sp.delete(key);
      const qs = sp.toString();
      router[mode](qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
  const openTask = useCallback((id: string) => setParam("task", id, "push"), [setParam]);
  const closeTask = useCallback(() => setParam("task", null), [setParam]);

  const { data: categories } = useCategories();
  const { data: overview } = useOverview();
  const today = useTasks({ view: "today" });
  const week = useTasks({ view: "week" });
  const later = useTasks({ view: "later" });
  const inbox = useTasks({ view: "inbox" });
  const doneQ = useTasks({ done: true });
  const loaded = !!(today.data && week.data && later.data && inbox.data);

  const taskMap = useMemo(() => {
    const m = new Map<string, Task>();
    for (const list of [today.data, week.data, later.data, inbox.data]) list?.forEach((t) => m.set(t.id, t));
    return m;
  }, [today.data, week.data, later.data, inbox.data]);

  // Порядок id по группам из данных сервера (с учётом фильтра категории).
  const serverOrder = useMemo<Order>(() => {
    const pick = (list?: Task[]) =>
      (list ?? []).filter((t) => !categoryId || t.category_id === categoryId).map((t) => t.id);
    return { today: pick(today.data), week: pick(week.data), later: pick(later.data), inbox: pick(inbox.data) };
  }, [today.data, week.data, later.data, inbox.data, categoryId]);
  const serverKey = JSON.stringify(serverOrder);

  const [order, setOrder] = useState<Order>(EMPTY_ORDER);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fetching = useIsFetching({ queryKey: keys.tasks });

  // Синхронизируем локальный порядок с сервером, только когда ничего не перетаскивается и не сохраняется.
  useEffect(() => {
    if (activeId || saving || fetching > 0) return;
    setOrder(JSON.parse(serverKey) as Order);
  }, [serverKey, activeId, saving, fetching]);

  const update = useUpdateTask();
  const reorder = useReorderTasks();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const containerOf = (id: string, o: Order): GroupKey | null => {
    if ((GROUP_KEYS as string[]).includes(id)) return id as GroupKey;
    return GROUP_KEYS.find((k) => o[k].includes(id)) ?? null;
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const aId = String(active.id);
    const oId = String(over.id);
    setOrder((prev) => {
      const from = containerOf(aId, prev);
      const to = containerOf(oId, prev);
      if (!from || !to || from === to) return prev;
      const toList = prev[to];
      const overIndex = toList.indexOf(oId);
      let index = toList.length;
      if (overIndex >= 0) {
        const below = active.rect.current.translated && active.rect.current.translated.top > over.rect.top + over.rect.height / 2;
        index = overIndex + (below ? 1 : 0);
      }
      return {
        ...prev,
        [from]: prev[from].filter((id) => id !== aId),
        [to]: [...toList.slice(0, index), aId, ...toList.slice(index)],
      };
    });
  };

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    const aId = String(active.id);
    setActiveId(null);
    if (!over) {
      setOrder(JSON.parse(serverKey) as Order);
      return;
    }
    const oId = String(over.id);
    const to = containerOf(aId, order);
    if (!to) return;
    let list = order[to];
    const oldIdx = list.indexOf(aId);
    const newIdx = list.indexOf(oId);
    if (newIdx >= 0 && oldIdx !== newIdx) {
      list = arrayMove(list, oldIdx, newIdx);
      setOrder({ ...order, [to]: list });
    }

    const task = taskMap.get(aId);
    if (!task) return;
    const from: GroupKey = (task.view as GroupKey | null) ?? "inbox";
    const moved = from !== to;
    const sameSpot = !moved && list.every((id, i) => id === serverOrder[to][i]);
    if (sameSpot) return;

    // Строго возрастающие sort на пуле значений, уже занятых этой группой.
    const pool = list
      .map((id) => taskMap.get(id)?.sort ?? 0)
      .sort((a, b) => a - b);
    let prev = -Infinity;
    const items = list.map((id, i) => {
      const sort = Math.max(pool[i], prev + 1);
      prev = sort;
      return { id, sort, ...(id === aId && moved ? { bucket: to } : {}) };
    });

    setSaving(true);
    try {
      if (moved) {
        const patch = bucketPatch(task, to);
        if (patch.due_date === null) await update.mutateAsync({ id: aId, ...patch });
      }
      await reorder.mutateAsync(items);
    } catch {
      toast.error("Не удалось сохранить порядок");
    } finally {
      setSaving(false);
    }
  };

  const activeTask = activeId ? taskMap.get(activeId) : undefined;

  // Статистика
  const totalOpen = taskMap.size;
  const doneTodayList = useMemo(() => {
    const t = todayStr();
    return (doneQ.data ?? []).filter(
      (x) =>
        x.parent_id === null &&
        x.completed_at &&
        format(parseISO(x.completed_at), "yyyy-MM-dd") === t &&
        (!categoryId || x.category_id === categoryId),
    );
  }, [doneQ.data, categoryId]);
  const [doneOpen, setDoneOpen] = useState(false);

  const resolve = (ids: string[]) => ids.map((id) => taskMap.get(id)).filter((t): t is Task => !!t);

  return (
    <>
      <PageHeader
        title="Задачи"
        actions={
          <Button variant="ghost" icon={<Flag />} onClick={() => openCreate("goal")}>
            Новая цель
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-5">
        <Card variant="accent" className="anim-pop md:col-span-2">
          <CardHeader tone="onColor" title="Закрыто сегодня" />
          {overview ? (
            <>
              <div className="mt-5 text-[44px] font-bold leading-none tabular-nums">
                {overview.tasks_today.done}
                <span className="text-white/60">/{overview.tasks_today.total}</span>
              </div>
              <div className="mt-6 flex gap-8 text-[13px]">
                <div>
                  <div className="text-white/70">Просрочено</div>
                  <div className="mt-0.5 text-lg font-semibold tabular-nums">{overview.tasks_today.overdue}</div>
                </div>
                <div>
                  <div className="text-white/70">Всего задач</div>
                  <div className="mt-0.5 text-lg font-semibold tabular-nums">{totalOpen}</div>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-5 flex flex-col gap-4">
              <Skeleton className="h-11 w-28 !bg-none !bg-white/20" />
              <Skeleton className="h-10 w-48 !bg-none !bg-white/20" />
            </div>
          )}
        </Card>
        <Card className="anim-pop md:col-span-3" style={{ animationDelay: "60ms" }}>
          <CardHeader title="Загрузка по дням" subtitle="Закрыто и осталось за неделю" />
          {overview ? <WeekChart week={overview.week} /> : <Skeleton className="mt-4 h-36 w-full" />}
        </Card>
      </div>

      <div className="no-scrollbar -mx-4 mt-6 flex items-center gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        <Pill active={!categoryId} onClick={() => setParam("category", null)}>
          Все
        </Pill>
        {(categories ?? []).map((c) => (
          <Pill
            key={c.id}
            color={c.color}
            active={categoryId === c.id}
            onClick={() => setParam("category", categoryId === c.id ? null : c.id)}
          >
            {c.name}
          </Pill>
        ))}
        <Link
          href="/settings"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium text-fg-sub transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          <Plus size={14} />
          Категория
        </Link>
      </div>

      <div className="mt-4">
        {loaded ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={() => {
              setActiveId(null);
              setOrder(JSON.parse(serverKey) as Order);
            }}
          >
            <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
              {GROUP_KEYS.map((g) => (
                <TaskGroup key={g} group={g} tasks={resolve(order[g])} categoryId={categoryId} onOpen={openTask} />
              ))}
            </div>
            <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
              {activeTask ? <TaskItem task={activeTask} hideActions dragging className="cursor-grabbing" /> : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-44 rounded-card" />
            ))}
          </div>
        )}
      </div>

      {doneTodayList.length > 0 && (
        <section className="mt-5 rounded-card bg-surface p-3 shadow-card md:p-4">
          <button
            type="button"
            onClick={() => setDoneOpen((v) => !v)}
            aria-expanded={doneOpen}
            className="flex w-full items-center gap-2.5 px-2.5 py-1 text-left"
          >
            <ChevronRight size={16} className={clsx("text-fg-sub transition-transform duration-200", doneOpen && "rotate-90")} />
            <span className="size-2.5 rounded-full bg-success" />
            <span className="text-[15px] font-semibold">Выполнено</span>
            <span className="ml-auto text-[13px] tabular-nums text-fg-sub">{doneTodayList.length}</span>
          </button>
          {doneOpen && (
            <div className="anim-fade mt-1">
              {doneTodayList.map((t) => (
                <TaskItem key={t.id} task={t} onOpen={openTask} />
              ))}
            </div>
          )}
        </section>
      )}

      <GoalsSection onOpen={openTask} />

      <TaskSheet taskId={taskParam} onClose={closeTask} />
    </>
  );
}

function WeekChart({ week }: { week: DayLoad[] }) {
  const today = todayStr();
  const max = Math.max(1, ...week.map((d) => d.tasks_done + d.tasks_open));
  const H = 112;
  return (
    <div className="mt-4">
      <div className="flex items-end justify-between gap-2 sm:gap-4" style={{ height: H }}>
        {week.map((d) => {
          const total = d.tasks_done + d.tasks_open;
          const h = (total / max) * H;
          const doneH = total ? (d.tasks_done / total) * h : 0;
          return (
            <div
              key={d.date}
              className="flex flex-1 flex-col justify-end"
              style={{ height: H }}
              title={`${d.tasks_done} закрыто, ${d.tasks_open} осталось`}
            >
              {total === 0 ? (
                <div className="h-1.5 rounded-full bg-surface-2" />
              ) : (
                <div className="flex flex-col overflow-hidden rounded-xl transition-[height] duration-300 ease-out" style={{ height: h }}>
                  <div className="bg-surface-2" style={{ flex: d.tasks_open }} />
                  <div className="bg-accent" style={{ height: doneH }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between gap-2 sm:gap-4">
        {week.map((d) => (
          <div
            key={d.date}
            className={clsx(
              "flex-1 text-center text-[12px] capitalize",
              d.date === today ? "font-semibold text-accent" : "text-fg-sub",
            )}
          >
            {format(parseISO(d.date), "EEEEEE", { locale: ru })}
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-4 text-[12px] text-fg-sub">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-accent" />
          Закрыто
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-surface-2 ring-1 ring-inset ring-line" />
          Осталось
        </span>
      </div>
    </div>
  );
}
