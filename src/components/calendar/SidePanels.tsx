"use client";
import { useMemo } from "react";
import clsx from "clsx";
import { addDays, addMonths, format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CardHeader } from "@/components/ui/CardHeader";
import { Checkbox } from "@/components/ui/Checkbox";
import { IconButton } from "@/components/ui/IconButton";
import { Skeleton } from "@/components/ui/Skeleton";
import type { CalendarEvent } from "@/lib/queries";
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "@/lib/ui-constants";
import { EVENT_TYPES, type EventType } from "@/shared/schemas";
import {
  fmtDuration,
  fmtTime,
  monthGridRange,
  monthName,
  overlapsDay,
  sameDay,
  sortItems,
  startOfDay,
  ymd,
  type CalItem,
} from "./utils";

const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

interface MiniProps {
  month: Date;
  onMonthChange: (m: Date) => void;
  selected: Date;
  highlight: { from: Date; to: Date };
  items: CalItem[];
  now: Date | null;
  onPick: (d: Date) => void;
}

export function MiniCalendar({ month, onMonthChange, selected, highlight, items, now, onPick }: MiniProps) {
  const days = useMemo(() => {
    const { from } = monthGridRange(month);
    return Array.from({ length: 42 }, (_, i) => addDays(from, i));
  }, [month]);
  const withItems = useMemo(() => {
    const set = new Set<string>();
    for (const d of days) if (items.some((it) => overlapsDay(it, d))) set.add(ymd(d));
    return set;
  }, [days, items]);
  const hf = startOfDay(highlight.from).getTime();
  const ht = startOfDay(highlight.to).getTime();

  return (
    <Card padded={false} className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="pl-1 text-[15px] font-semibold">{monthName(month)}</span>
        <div className="flex">
          <IconButton label="Предыдущий месяц" size="sm" onClick={() => onMonthChange(addMonths(month, -1))}>
            <ChevronLeft />
          </IconButton>
          <IconButton label="Следующий месяц" size="sm" onClick={() => onMonthChange(addMonths(month, 1))}>
            <ChevronRight />
          </IconButton>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-medium uppercase text-fg-sub">
        {WD.map((w) => (
          <span key={w} className="py-1">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((d, i) => {
          const t = startOfDay(d).getTime();
          const inRange = t >= hf && t <= ht;
          const isSel = sameDay(d, selected);
          const today = !!now && sameDay(d, now);
          const other = d.getMonth() !== month.getMonth();
          const col = i % 7;
          return (
            <button
              key={ymd(d)}
              type="button"
              onClick={() => onPick(d)}
              aria-label={format(d, "d MMMM", { locale: ru })}
              className={clsx(
                "relative flex h-9 items-center justify-center",
                inRange && "bg-accent-soft",
                inRange && (col === 0 || t === hf) && "rounded-l-full",
                inRange && (col === 6 || t === ht) && "rounded-r-full",
              )}
            >
              <span
                className={clsx(
                  "flex size-8 items-center justify-center rounded-full text-[12px] font-medium transition-colors",
                  isSel ? "bg-accent text-white" : today ? "text-accent ring-1 ring-accent" : other ? "text-fg-sub/70" : "text-fg",
                  !isSel && !inRange && "hover:bg-surface-2",
                )}
              >
                {d.getDate()}
              </span>
              {withItems.has(ymd(d)) && (
                <span className={clsx("absolute bottom-0.5 size-1 rounded-full", isSel ? "bg-white" : "bg-accent")} />
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

interface TodayProps {
  items: CalItem[];
  loading: boolean;
  now: Date | null;
  onOpenEvent: (id: string) => void;
  onOpenTask: (id: string) => void;
  onToggleTask: (id: string) => void;
}

export function TodayCard({ items, loading, now, onOpenEvent, onOpenTask, onToggleTask }: TodayProps) {
  const today = useMemo(() => now ?? new Date(), [now]);
  const list = useMemo(() => items.filter((i) => overlapsDay(i, today)).sort(sortItems), [items, today]);
  return (
    <Card padded={false} className="p-4">
      <CardHeader icon={<CalendarDays />} title="Сегодня" subtitle={format(today, "EEEE, d MMMM", { locale: ru })} className="mb-3" />
      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      ) : list.length === 0 ? (
        <p className="rounded-field bg-surface-2 px-3 py-3 text-center text-[13px] text-fg-sub">На сегодня ничего не запланировано</p>
      ) : (
        <ul className="flex flex-col">
          {list.map((it) => (
            <li key={it.key} className="flex items-center gap-2.5 rounded-xl py-1.5">
              <span className="w-10 shrink-0 text-[12px] text-fg-sub">{it.allDay ? "день" : fmtTime(it.start)}</span>
              {it.kind === "task" ? (
                <Checkbox checked={!!it.done} onChange={() => onToggleTask(it.id)} color={it.color} size={16} aria-label={`Отметить «${it.title}»`} />
              ) : (
                <span className="w-4 shrink-0 text-center">
                  <span className="inline-block size-2.5 rounded-full" style={{ background: it.color }} />
                </span>
              )}
              <button
                type="button"
                onClick={() => (it.kind === "event" ? onOpenEvent(it.id) : onOpenTask(it.id))}
                className="min-w-0 flex-1 truncate text-left text-[13px] font-medium"
              >
                <span className="strike" data-done={!!it.done}>
                  {it.title}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function TimeSpentCard({
  events,
  week,
  loading,
}: {
  events: CalendarEvent[] | undefined;
  week: { from: Date; to: Date };
  loading: boolean;
}) {
  const { totals, total, max } = useMemo(() => {
    const totals: Record<EventType, number> = { meeting: 0, sport: 0, personal: 0, focus: 0, other: 0 };
    const w0 = startOfDay(week.from).getTime();
    const w1 = addDays(startOfDay(week.to), 1).getTime();
    for (const e of events ?? []) {
      if (e.all_day) continue;
      const s = Math.max(Date.parse(e.start_at), w0);
      const en = Math.min(Date.parse(e.end_at), w1);
      if (en > s) totals[e.type] += (en - s) / 60000;
    }
    const vals = Object.values(totals);
    return { totals, total: vals.reduce((a, b) => a + b, 0), max: Math.max(...vals, 1) };
  }, [events, week]);

  return (
    <Card padded={false} className="p-4">
      <CardHeader
        icon={<Clock />}
        title="На что ушло время"
        subtitle={total > 0 ? `Всего ${fmtDuration(total)} за неделю` : "За эту неделю"}
        className="mb-3"
      />
      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
        </div>
      ) : total === 0 ? (
        <p className="rounded-field bg-surface-2 px-3 py-3 text-center text-[13px] text-fg-sub">На этой неделе событий нет</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {EVENT_TYPES.filter((t) => totals[t] > 0)
            .sort((a, b) => totals[b] - totals[a])
            .map((t) => (
              <li key={t}>
                <div className="mb-1 flex items-baseline justify-between text-[12px]">
                  <span className="font-medium">{EVENT_TYPE_LABELS[t]}</span>
                  <span className="text-fg-sub">{fmtDuration(totals[t])}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full transition-[width] duration-300 ease-out"
                    style={{ width: `${(totals[t] / max) * 100}%`, background: EVENT_TYPE_COLORS[t] }}
                  />
                </div>
              </li>
            ))}
        </ul>
      )}
    </Card>
  );
}
