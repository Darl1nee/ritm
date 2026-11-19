"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowRight, CalendarClock, FolderKanban, Play, Plus, Sun, Timer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CardHeader } from "@/components/ui/CardHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFocusTimer, useQuickCreate } from "@/components/shell";
import { useCategories, useOverview, type Overview } from "@/lib/queries";
import { EVENT_TYPE_COLORS } from "@/lib/ui-constants";
import { TaskItem } from "@/components/tasks/TaskItem";

function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Доброе утро";
  if (hour >= 12 && hour < 18) return "Добрый день";
  if (hour >= 18 && hour < 23) return "Добрый вечер";
  return "Доброй ночи";
}

/** Минуты → «2 ч 00». */
function hm(min: number): string {
  return `${Math.floor(min / 60)} ч ${String(min % 60).padStart(2, "0")}`;
}

const delay = (i: number): React.CSSProperties => ({ animationDelay: `${i * 50}ms` });

export function OverviewView() {
  const { data, isLoading, isError } = useOverview();

  const title = data ? `${greeting(new Date().getHours())}, ${data.user_name}!` : <Skeleton className="h-8 w-72 max-w-full" />;
  const subtitle = data ? format(parseISO(data.date), "EEEE, d MMMM", { locale: ru }) : undefined;

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      {data ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <FocusCard data={data} i={0} />
          <TasksCard data={data} i={1} />
          <UpNextCard data={data} i={2} />
          <TodayCard data={data} i={3} />
          <ProjectsCard data={data} i={4} />
          <WeekCard data={data} i={5} />
        </div>
      ) : isError && !isLoading ? (
        <EmptyState text="Не удалось загрузить обзор" />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className={clsx("h-56 rounded-card", i === 3 && "md:col-span-2")} />
          ))}
          <Skeleton className="h-40 rounded-card md:col-span-2 lg:col-span-3" />
        </div>
      )}
    </>
  );
}

function FocusCard({ data, i }: { data: Overview; i: number }) {
  const timer = useFocusTimer();
  const { minutes, sessions, goal_min } = data.focus;
  const pct = goal_min > 0 ? (minutes / goal_min) * 100 : 0;
  return (
    <Card variant="accent" className="anim-pop lg:order-1" style={delay(i)}>
      <CardHeader
        tone="onColor"
        icon={<Timer />}
        title="В фокусе сегодня"
        action={
          <IconButton
            label={timer.status === "idle" ? "Запустить таймер" : "Таймер уже запущен"}
            variant="ghost"
            disabled={timer.status !== "idle"}
            className="bg-white/20 text-white hover:bg-white/30 hover:text-white"
            onClick={() => timer.start()}
          >
            <Play className="fill-current" />
          </IconButton>
        }
      />
      <div className="mt-5 text-[44px] font-bold leading-none tabular-nums">
        {minutes}
        <span className="ml-1.5 text-xl font-medium text-white/70">мин</span>
      </div>
      <ProgressBar onColor value={pct} className="mt-5" />
      <div className="mt-3 flex justify-between text-[13px]">
        <span>
          <span className="text-white/70">Подходов </span>
          <span className="font-semibold tabular-nums">{sessions}</span>
        </span>
        <span>
          <span className="text-white/70">Цель </span>
          <span className="font-semibold tabular-nums">{hm(goal_min)}</span>
        </span>
      </div>
    </Card>
  );
}

function TasksCard({ data, i }: { data: Overview; i: number }) {
  const { done, total, overdue } = data.tasks_today;
  const pct = total > 0 ? (done / total) * 100 : 0;
  return (
    <Link href="/tasks" className="group block lg:order-2">
      <Card className="anim-pop h-full transition-shadow duration-200 group-hover:shadow-pop" style={delay(i)}>
        <CardHeader title="Задачи закрыты" subtitle="Сегодня" />
        <div className="mt-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-[44px] font-bold leading-none tabular-nums">
              {done}
              <span className="text-fg-sub">/{total}</span>
            </div>
            {overdue > 0 ? (
              <div className="mt-3 text-[13px] font-medium text-danger">просрочено {overdue}</div>
            ) : (
              <div className="mt-3 text-[13px] text-fg-sub">просрочек нет</div>
            )}
          </div>
          <ProgressRing value={pct} size={84} stroke={7}>
            <span className="text-[15px] font-semibold tabular-nums">{Math.round(pct)}%</span>
          </ProgressRing>
        </div>
      </Card>
    </Link>
  );
}

interface UpNextItem {
  key: string;
  sort: string;
  label: string;
  title: string;
  color: string;
  sub?: string;
}

function UpNextCard({ data, i }: { data: Overview; i: number }) {
  const { open } = useQuickCreate();
  const { data: categories } = useCategories();
  const timeOf = (iso: string) => format(parseISO(iso), "HH:mm");

  const items: UpNextItem[] = [
    ...data.events_today.map((e) => ({
      key: `e-${e.id}`,
      sort: e.all_day ? "00:00" : timeOf(e.start_at),
      label: e.all_day ? "Весь день" : `${timeOf(e.start_at)}–${timeOf(e.end_at)}`,
      title: e.title,
      color: EVENT_TYPE_COLORS[e.type],
      sub: e.location || undefined,
    })),
    ...data.tasks_today.items
      .filter((t) => t.due_time && !t.overdue)
      .map((t) => ({
        key: `t-${t.id}`,
        sort: t.due_time!,
        label: t.due_time!,
        title: t.title,
        color: categories?.find((c) => c.id === t.category_id)?.color ?? "var(--accent)",
        sub: "Задача",
      })),
  ]
    .sort((a, b) => a.sort.localeCompare(b.sort))
    .slice(0, 5);

  return (
    <Card className="anim-pop lg:order-3" style={delay(i)}>
      <CardHeader icon={<CalendarClock />} title="Дальше сегодня" />
      <div className="mt-4 flex flex-col gap-2.5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center text-sm text-fg-sub">
            Ничего не запланировано
            <Button size="sm" icon={<Plus />} onClick={() => open("event")}>
              Событие
            </Button>
          </div>
        ) : (
          items.map((it) => (
            <div key={it.key} className="flex items-stretch gap-3">
              <span className="w-1 shrink-0 rounded-full" style={{ background: it.color }} />
              <div className="min-w-0 flex-1 py-0.5">
                <div className="truncate text-[14px] font-medium leading-snug">{it.title}</div>
                <div className="truncate text-[12px] tabular-nums text-fg-sub">
                  {it.label}
                  {it.sub ? ` · ${it.sub}` : ""}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function TodayCard({ data, i }: { data: Overview; i: number }) {
  const router = useRouter();
  const { open } = useQuickCreate();
  const items = data.tasks_today.items.slice(0, 6);
  const rest = data.tasks_today.items.length - items.length;
  return (
    <Card className="anim-pop md:col-span-2 lg:order-4" style={delay(i)}>
      <CardHeader
        icon={<Sun />}
        title="Сегодня"
        subtitle={data.tasks_today.items.length ? `Осталось ${data.tasks_today.items.length}` : undefined}
        action={
          <Button size="sm" variant="secondary" icon={<Plus />} onClick={() => open("task", { bucket: "today" })}>
            Добавить
          </Button>
        }
      />
      <div className="-mx-2.5 mt-3">
        {items.length === 0 ? (
          <div className="px-2.5">
            <EmptyState compact text="На сегодня всё сделано" onClick={() => open("task", { bucket: "today" })} />
          </div>
        ) : (
          items.map((t) => (
            <TaskItem key={t.id} task={t} compact hideActions onOpen={(id) => router.push(`/tasks?task=${id}`)} />
          ))
        )}
      </div>
      <Link
        href="/tasks"
        className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent transition-opacity hover:opacity-80"
      >
        Все задачи{rest > 0 ? ` (ещё ${rest})` : ""}
        <ArrowRight size={14} />
      </Link>
    </Card>
  );
}

function ProjectsCard({ data, i }: { data: Overview; i: number }) {
  const { open } = useQuickCreate();
  const projects = data.projects.slice(0, 5);
  return (
    <Card className="anim-pop lg:order-5" style={delay(i)}>
      <CardHeader icon={<FolderKanban />} title="Проекты" />
      <div className="mt-4 flex flex-col gap-4">
        {projects.length === 0 ? (
          <EmptyState compact text="Создайте первый проект" onClick={() => open("project")} />
        ) : (
          projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="group block">
              <div className="flex items-center gap-2.5">
                <span className="text-lg leading-none">{p.emoji ?? "📋"}</span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium transition-colors group-hover:text-accent">
                  {p.title}
                </span>
                <span className="text-[12px] tabular-nums text-fg-sub">{p.progress.percent}%</span>
              </div>
              <ProgressBar value={p.progress.percent} color={p.color} className="mt-2" />
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}

function WeekCard({ data, i }: { data: Overview; i: number }) {
  const max = Math.max(1, ...data.week.map((d) => d.tasks_done + d.tasks_open));
  const BAR = 40;
  return (
    <Card className="anim-pop md:col-span-2 lg:order-6 lg:col-span-3" style={delay(i)}>
      <CardHeader title="Неделя" subtitle="Нагрузка по дням" />
      <div className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-3">
        {data.week.map((d) => {
          const isToday = d.date === data.date;
          const total = d.tasks_done + d.tasks_open;
          const h = total ? Math.max(6, (total / max) * BAR) : 0;
          const doneH = total ? (d.tasks_done / total) * h : 0;
          return (
            <Link
              key={d.date}
              href={`/calendar?date=${d.date}`}
              className="group flex flex-col items-center gap-2 rounded-2xl py-2 transition-colors duration-150 hover:bg-surface-2"
              title={`${d.tasks_done} закрыто, ${d.tasks_open} осталось, событий: ${d.events}`}
            >
              <span className="text-[12px] capitalize text-fg-sub">{format(parseISO(d.date), "EEEEEE", { locale: ru })}</span>
              <span
                className={clsx(
                  "flex size-9 items-center justify-center rounded-full text-[15px] font-semibold tabular-nums",
                  isToday ? "bg-accent text-white" : "text-fg",
                )}
              >
                {format(parseISO(d.date), "d")}
              </span>
              <div className="flex items-end" style={{ height: BAR }}>
                {total === 0 ? (
                  <div className="h-1 w-4 rounded-full bg-surface-2 group-hover:bg-line" />
                ) : (
                  <div className="flex w-4 flex-col justify-end overflow-hidden rounded-md bg-accent/25" style={{ height: h }}>
                    <div className="bg-accent" style={{ height: doneH }} />
                  </div>
                )}
              </div>
              <div className="flex h-1.5 items-center gap-1">
                {Array.from({ length: Math.min(d.events, 3) }).map((_, k) => (
                  <span key={k} className="size-1.5 rounded-full" style={{ background: EVENT_TYPE_COLORS.personal }} />
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
