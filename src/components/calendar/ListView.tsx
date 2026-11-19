"use client";
import { useMemo } from "react";
import { MapPin } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { LIST_DAYS, addDays, dayLabel, fmtTime, overlapsDay, sortItems, startOfDay, ymd, type CalItem } from "./utils";

interface ListViewProps {
  from: Date;
  items: CalItem[];
  now: Date | null;
  onOpenEvent: (id: string) => void;
  onOpenTask: (id: string) => void;
  onToggleTask: (id: string) => void;
  onCreate: () => void;
}

export function ListView({ from, items, now, onOpenEvent, onOpenTask, onToggleTask, onCreate }: ListViewProps) {
  const groups = useMemo(() => {
    const f = startOfDay(from);
    return Array.from({ length: LIST_DAYS }, (_, i) => addDays(f, i))
      .map((d) => ({ day: d, list: items.filter((it) => overlapsDay(it, d)).sort(sortItems) }))
      .filter((g) => g.list.length > 0);
  }, [from, items]);

  if (groups.length === 0) {
    return <EmptyState text="Ничего не запланировано — создать событие" onClick={onCreate} />;
  }
  const ref = now ?? new Date();
  return (
    <div className="flex flex-col gap-5">
      {groups.map(({ day, list }) => (
        <section key={ymd(day)}>
          <h3 className="mb-1.5 px-1 text-[13px] font-semibold">{dayLabel(day, ref)}</h3>
          <ul className="flex flex-col">
            {list.map((it) => (
              <li key={it.key} className="flex items-center gap-3 rounded-xl px-1 py-2 hover:bg-surface-2/60">
                <span className="w-[62px] shrink-0 whitespace-nowrap text-[12px] text-fg-sub">{it.allDay ? "Весь день" : fmtTime(it.start)}</span>
                {it.kind === "task" ? (
                  <Checkbox checked={!!it.done} onChange={() => onToggleTask(it.id)} color={it.color} size={18} aria-label={`Отметить «${it.title}»`} />
                ) : (
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: it.color }} />
                )}
                <button
                  type="button"
                  onClick={() => (it.kind === "event" ? onOpenEvent(it.id) : onOpenTask(it.id))}
                  className="flex min-w-0 flex-1 flex-col text-left"
                >
                  <span className="truncate text-sm font-medium">
                    <span className="strike" data-done={!!it.done}>
                      {it.title}
                    </span>
                  </span>
                  {(it.location || (!it.allDay && it.kind === "event")) && (
                    <span className="flex items-center gap-1 truncate text-[12px] text-fg-sub">
                      {!it.allDay && it.kind === "event" && `${fmtTime(it.start)}–${fmtTime(it.end)}`}
                      {it.location && (
                        <>
                          <MapPin size={11} className="shrink-0" /> {it.location}
                        </>
                      )}
                    </span>
                  )}
                </button>
                <span className="hidden shrink-0 text-[11px] text-fg-sub sm:inline">{it.kind === "task" ? "Задача" : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
