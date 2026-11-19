"use client";
import { useMemo } from "react";
import clsx from "clsx";
import { addDays } from "date-fns";
import { atMinutes, fmtTime, monthGridRange, overlapsDay, sameDay, sortItems, ymd, type CalItem } from "./utils";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MAX = 3;

interface MonthGridProps {
  month: Date;
  items: CalItem[];
  now: Date | null;
  onOpenEvent: (id: string) => void;
  onOpenTask: (id: string) => void;
  onCreateAt: (start: Date, end: Date) => void;
  onGoWeek: (day: Date) => void;
}

export function MonthGrid({ month, items, now, onOpenEvent, onOpenTask, onCreateAt, onGoWeek }: MonthGridProps) {
  const days = useMemo(() => {
    const { from } = monthGridRange(month);
    return Array.from({ length: 42 }, (_, i) => addDays(from, i));
  }, [month]);
  const byDay = useMemo(() => {
    const m = new Map<string, CalItem[]>();
    for (const d of days) m.set(ymd(d), items.filter((i) => overlapsDay(i, d)).sort(sortItems));
    return m;
  }, [days, items]);

  return (
    <div className="overflow-hidden rounded-[16px] border border-line">
      <div className="grid grid-cols-7 border-b border-line bg-surface-2/50">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-2 text-center text-[11px] font-medium uppercase tracking-wide text-fg-sub">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const list = byDay.get(ymd(d)) ?? [];
          const today = !!now && sameDay(d, now);
          const other = d.getMonth() !== month.getMonth();
          const rest = list.length - MAX;
          return (
            <div
              key={ymd(d)}
              onClick={() => onCreateAt(atMinutes(d, 600), atMinutes(d, 660))}
              className={clsx(
                "group/cell flex min-h-[64px] min-w-0 cursor-cell flex-col gap-0.5 border-line p-1 transition-colors hover:bg-surface-2/50 sm:min-h-[108px] sm:p-1.5",
                i >= 7 && "border-t",
                i % 7 !== 0 && "border-l",
                other && "bg-surface-2/30",
              )}
            >
              <div className="flex justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onGoWeek(d);
                  }}
                  className={clsx(
                    "flex size-6 items-center justify-center rounded-full text-[12px] font-semibold",
                    today ? "bg-accent text-white" : other ? "text-fg-sub" : "text-fg hover:bg-surface-2",
                  )}
                  aria-label={`Открыть неделю ${ymd(d)}`}
                >
                  {d.getDate()}
                </button>
              </div>

              {/* Десктоп: строки */}
              <div className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                {list.slice(0, MAX).map((it) => (
                  <button
                    key={it.key}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (it.kind === "event") onOpenEvent(it.id);
                      else onOpenTask(it.id);
                    }}
                    className={clsx(
                      "flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-[11px] leading-tight hover:bg-surface-2",
                      other && "opacity-60",
                      it.done && "opacity-50",
                    )}
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={it.kind === "task" ? { boxShadow: `inset 0 0 0 1.5px ${it.color}` } : { background: it.color }}
                    />
                    {!it.allDay && <span className="shrink-0 text-fg-sub">{fmtTime(it.start)}</span>}
                    <span className={clsx("truncate font-medium", it.done && "line-through")}>{it.title}</span>
                  </button>
                ))}
                {rest > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onGoWeek(d);
                    }}
                    className="rounded-md px-1 py-0.5 text-left text-[11px] font-medium text-accent hover:bg-accent-soft"
                  >
                    + ещё {rest}
                  </button>
                )}
              </div>

              {/* Телефон: точки */}
              <div className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                {list.slice(0, 4).map((it) => (
                  <span key={it.key} className="size-1.5 rounded-full" style={{ background: it.color }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
