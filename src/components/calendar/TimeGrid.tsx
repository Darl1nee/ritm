"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { MapPin } from "lucide-react";
import { AgentBadge, isAgentSource } from "@/components/ui/AgentBadge";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  DAY_MIN,
  HOUR_H,
  MIN_H,
  atMinutes,
  bgOf,
  clamp,
  fmtTime,
  layoutDay,
  minutesOfDay,
  overlapsDay,
  sameDay,
  snap,
  sortItems,
  type CalItem,
  type Seg,
} from "./utils";

interface DragState {
  id: string;
  mode: "move" | "resize";
  dayIdx: number;
  start: number;
  end: number;
  color: string;
  title: string;
}
interface SelState {
  dayIdx: number;
  a: number;
  b: number;
}

interface TimeGridProps {
  days: Date[];
  items: CalItem[];
  now: Date | null;
  onOpenEvent: (id: string) => void;
  onOpenTask: (id: string) => void;
  onToggleTask: (id: string) => void;
  onCreate: (start: Date, end: Date) => void;
  onMove: (id: string, start: Date, end: Date) => void;
}

const range = (s: number, e: number) => `${fmtTime(atMinutes(new Date(2000, 0, 1), s))}–${fmtTime(atMinutes(new Date(2000, 0, 1), e))}`;

export function TimeGrid({ days, items, now, onOpenEvent, onOpenTask, onToggleTask, onCreate, onMove }: TimeGridProps) {
  const n = days.length;
  const scrollRef = useRef<HTMLDivElement>(null);
  const colsRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const lastPointer = useRef<string>("mouse");
  const [drag, setDrag] = useState<DragState | null>(null);
  const [sel, setSel] = useState<SelState | null>(null);

  const template = `var(--gut) repeat(${n}, minmax(0, 1fr))`;

  const timed = useMemo(() => items.filter((i) => !i.allDay), [items]);
  const perDay = useMemo(
    () => days.map((d) => layoutDay(timed.filter((i) => overlapsDay(i, d)).sort(sortItems), d)),
    [days, timed],
  );
  const allDayPerDay = useMemo(
    () => days.map((d) => items.filter((i) => i.allDay && overlapsDay(i, d)).sort(sortItems)),
    [days, items],
  );
  const hasAllDay = allDayPerDay.some((l) => l.length > 0);

  // Прокрутка при открытии: к текущему времени (если сегодня видно) или к 7:00.
  const scrolled = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || scrolled.current || !now) return;
    scrolled.current = true;
    const hasToday = days.some((d) => sameDay(d, now));
    const hour = hasToday ? Math.max(7, now.getHours() - 2) : 7;
    el.scrollTop = hour * HOUR_H - 4;
  }, [days, now]);

  const pointerPos = (clientX: number, clientY: number) => {
    const r = colsRef.current!.getBoundingClientRect();
    return {
      dayIdx: clamp(Math.floor(((clientX - r.left) / r.width) * n), 0, n - 1),
      min: clamp((clientY - r.top) / MIN_H, 0, DAY_MIN),
    };
  };

  const startItemDrag = (e: React.PointerEvent, seg: Seg, dayIdx: number, mode: "move" | "resize") => {
    if (e.button !== 0 || e.pointerType === "touch" || seg.item.kind !== "event") return;
    e.stopPropagation();
    if (mode === "resize") e.preventDefault();
    const { item } = seg;
    const sx = e.clientX;
    const sy = e.clientY;
    const grab = pointerPos(sx, sy).min - seg.startMin;
    const realDur = Math.max(1, Math.round((item.end.getTime() - item.start.getTime()) / 60000));
    let moved = false;
    let latest: DragState | null = null;

    const onMoveEv = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
      moved = true;
      const p = pointerPos(ev.clientX, ev.clientY);
      if (mode === "move") {
        const dur = Math.min(realDur, DAY_MIN);
        const ns = clamp(snap(p.min - grab, 15), 0, DAY_MIN - dur);
        latest = { id: item.id, mode, dayIdx: p.dayIdx, start: ns, end: ns + dur, color: item.color, title: item.title };
      } else {
        const ne = clamp(snap(p.min, 15), seg.startMin + 15, DAY_MIN);
        latest = { id: item.id, mode, dayIdx, start: seg.startMin, end: ne, color: item.color, title: item.title };
      }
      setDrag(latest);
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", onMoveEv);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
    const onCancel = () => {
      cleanup();
      setDrag(null);
    };
    const onUp = () => {
      cleanup();
      setDrag(null);
      if (!moved || !latest) return;
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 0);
      const day = days[latest.dayIdx];
      const start = atMinutes(day, latest.start);
      const end = atMinutes(day, latest.end);
      if (start.getTime() === item.start.getTime() && end.getTime() === item.end.getTime()) return;
      onMove(item.id, start, end);
    };
    window.addEventListener("pointermove", onMoveEv);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  const finishCreate = (dayIdx: number, a: number, b: number, moved: boolean) => {
    let s: number;
    let en: number;
    if (!moved) {
      s = Math.floor(a / 30) * 30;
      en = s + 60;
    } else {
      s = Math.floor(Math.min(a, b) / 30) * 30;
      en = Math.max(Math.ceil(Math.max(a, b) / 30) * 30, s + 30);
    }
    s = clamp(s, 0, DAY_MIN - 30);
    en = clamp(en, s + 30, DAY_MIN);
    onCreate(atMinutes(days[dayIdx], s), atMinutes(days[dayIdx], en));
  };

  const startSelect = (e: React.PointerEvent, dayIdx: number) => {
    lastPointer.current = e.pointerType;
    if (e.button !== 0 || e.pointerType === "touch") return;
    if ((e.target as HTMLElement).closest("[data-block]")) return;
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    const a = pointerPos(sx, sy).min;
    let b = a;
    let moved = false;
    setSel({ dayIdx, a, b });
    const onMoveEv = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
      moved = true;
      b = pointerPos(ev.clientX, ev.clientY).min;
      setSel({ dayIdx, a, b });
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", onMoveEv);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
    const onCancel = () => {
      cleanup();
      setSel(null);
    };
    const onUp = () => {
      cleanup();
      setSel(null);
      finishCreate(dayIdx, a, b, moved);
    };
    window.addEventListener("pointermove", onMoveEv);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  const onColumnClick = (e: React.MouseEvent, dayIdx: number) => {
    if (lastPointer.current !== "touch") return;
    if ((e.target as HTMLElement).closest("[data-block]")) return;
    finishCreate(dayIdx, pointerPos(e.clientX, e.clientY).min, 0, false);
  };

  const todayIdx = now ? days.findIndex((d) => sameDay(d, now)) : -1;

  return (
    <div
      ref={scrollRef}
      className="relative overflow-y-auto overflow-x-hidden rounded-[16px] [--gut:40px] sm:[--gut:52px]"
      style={{ height: "clamp(420px, calc(100dvh - 360px), 820px)" }}
    >
      {/* Шапка дней и полоса «весь день» */}
      <div className="sticky top-0 z-40 bg-surface">
        <div className="grid border-b border-line" style={{ gridTemplateColumns: template }}>
          <div />
          {days.map((d) => {
            const today = !!now && sameDay(d, now);
            return (
              <div key={d.toISOString()} className="flex flex-col items-center gap-0.5 py-2">
                <span className={clsx("text-[11px] font-medium uppercase tracking-wide", today ? "text-accent" : "text-fg-sub")}>
                  {format(d, "EEEEEE", { locale: ru })}
                </span>
                <span
                  className={clsx(
                    "flex size-8 items-center justify-center rounded-full text-[15px] font-semibold",
                    today ? "bg-accent text-white" : "text-fg",
                  )}
                >
                  {d.getDate()}
                </span>
              </div>
            );
          })}
        </div>
        {hasAllDay && (
          <div className="grid border-b border-line" style={{ gridTemplateColumns: template }}>
            <div className="flex items-start justify-end px-1.5 pt-2 text-[10px] leading-tight text-fg-sub sm:pr-2">весь день</div>
            {allDayPerDay.map((list, i) => (
              <div key={i} className="flex min-w-0 flex-col gap-1 border-l border-line p-1">
                {list.map((it) => (
                  <AllDayChip key={it.key} item={it} onOpenEvent={onOpenEvent} onOpenTask={onOpenTask} onToggleTask={onToggleTask} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Сетка часов */}
      <div className="grid" style={{ gridTemplateColumns: template, height: 24 * HOUR_H }}>
        <div className="relative">
          {Array.from({ length: 24 }, (_, h) =>
            h === 0 ? null : (
              <span
                key={h}
                className="absolute right-1.5 -translate-y-1/2 text-[10px] text-fg-sub sm:right-2 sm:text-[11px]"
                style={{ top: h * HOUR_H }}
              >
                {String(h).padStart(2, "0")}:00
              </span>
            ),
          )}
        </div>
        <div ref={colsRef} className="relative grid" style={{ gridColumn: `2 / span ${n}`, gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {days.map((d, di) => {
            const today = di === todayIdx;
            return (
              <div
                key={d.toISOString()}
                className="relative cursor-cell border-l border-line"
                style={{
                  touchAction: "pan-y",
                  backgroundColor: today ? "color-mix(in srgb, var(--accent) 4%, transparent)" : undefined,
                  backgroundImage: "linear-gradient(to bottom, var(--line) 1px, transparent 1px)",
                  backgroundSize: `100% ${HOUR_H}px`,
                }}
                onPointerDown={(e) => startSelect(e, di)}
                onClick={(e) => onColumnClick(e, di)}
              >
                {perDay[di].map((sg) => (
                  <Block
                    key={sg.item.key}
                    seg={sg}
                    dimmed={drag?.id === sg.item.id}
                    onOpenEvent={onOpenEvent}
                    onOpenTask={onOpenTask}
                    onToggleTask={onToggleTask}
                    onDragStart={(e, mode) => startItemDrag(e, sg, di, mode)}
                    suppressClick={suppressClick}
                  />
                ))}

                {drag && drag.dayIdx === di && (
                  <div
                    className="pointer-events-none absolute inset-x-0.5 z-30 overflow-hidden rounded-[10px] border-l-[3px] px-2 py-1 text-[12px] leading-tight shadow-pop"
                    style={{
                      top: drag.start * MIN_H + 1,
                      height: Math.max(20, (drag.end - drag.start) * MIN_H - 2),
                      borderLeftColor: drag.color,
                      background: `color-mix(in srgb, ${drag.color} 22%, var(--surface))`,
                    }}
                  >
                    <div className="truncate font-semibold">{drag.title}</div>
                    <div className="text-[11px] text-fg-sub">{range(drag.start, drag.end)}</div>
                  </div>
                )}
                {sel && sel.dayIdx === di && <SelectionGhost sel={sel} />}

                {today && now && (
                  <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: minutesOfDay(now) * MIN_H }}>
                    <span className="absolute -left-[5px] -top-[4px] size-2 rounded-full bg-danger" />
                    <div className="h-[2px] w-full bg-danger" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SelectionGhost({ sel }: { sel: SelState }) {
  const lo = Math.min(sel.a, sel.b);
  const hi = Math.max(sel.a, sel.b);
  const moved = hi - lo > 2;
  const s = moved ? Math.floor(lo / 30) * 30 : Math.floor(sel.a / 30) * 30;
  const e = moved ? Math.max(Math.ceil(hi / 30) * 30, s + 30) : s + 60;
  return (
    <div
      className="pointer-events-none absolute inset-x-0.5 z-10 rounded-[10px] border border-accent/50 bg-accent-soft px-2 py-1 text-[11px] font-medium text-accent"
      style={{ top: s * MIN_H + 1, height: (e - s) * MIN_H - 2 }}
    >
      {range(s, Math.min(e, DAY_MIN))}
    </div>
  );
}

function Block({
  seg,
  dimmed,
  onOpenEvent,
  onOpenTask,
  onToggleTask,
  onDragStart,
  suppressClick,
}: {
  seg: Seg;
  dimmed: boolean;
  onOpenEvent: (id: string) => void;
  onOpenTask: (id: string) => void;
  onToggleTask: (id: string) => void;
  onDragStart: (e: React.PointerEvent, mode: "move" | "resize") => void;
  suppressClick: React.RefObject<boolean>;
}) {
  const { item } = seg;
  const h = Math.max(20, (seg.endMin - seg.startMin) * MIN_H - 2);
  const compact = h < 38;
  const style: React.CSSProperties = {
    top: seg.startMin * MIN_H + 1,
    height: h,
    left: `${(seg.col / seg.cols) * 100}%`,
    width: `${100 / seg.cols}%`,
  };
  const time = `${fmtTime(item.start)}–${fmtTime(item.end)}`;

  if (item.kind === "task") {
    return (
      <div data-block className="absolute z-[1] px-0.5" style={style}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => onOpenTask(item.id)}
          onKeyDown={(e) => e.key === "Enter" && onOpenTask(item.id)}
          className={clsx(
            "flex h-full cursor-pointer gap-1.5 overflow-hidden rounded-[10px] border border-dashed px-1.5 py-1 text-[12px] leading-tight transition-opacity hover:brightness-95",
            item.done && "opacity-55",
            compact ? "items-center" : "items-start",
          )}
          style={{ borderColor: item.color, background: bgOf(item.color, 8) }}
        >
          <Checkbox
            checked={!!item.done}
            onChange={() => onToggleTask(item.id)}
            color={item.color}
            size={16}
            aria-label={`Отметить «${item.title}»`}
            className="mt-px"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">
              <span className="strike" data-done={!!item.done}>
                {item.title}
              </span>
            </div>
            {!compact && <div className="text-[11px] text-fg-sub">{time}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-block
      role="button"
      tabIndex={0}
      className={clsx("absolute z-[1] px-0.5 transition-opacity", dimmed && "opacity-35")}
      style={style}
      onPointerDown={(e) => onDragStart(e, "move")}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        onOpenEvent(item.id);
      }}
      onKeyDown={(e) => e.key === "Enter" && onOpenEvent(item.id)}
    >
      <div
        className="group relative h-full cursor-pointer select-none overflow-hidden rounded-[10px] border-l-[3px] px-2 py-1 text-[12px] leading-tight transition-shadow hover:shadow-card"
        style={{ borderLeftColor: item.color, background: bgOf(item.color, 14) }}
      >
        {compact ? (
          <div className="flex items-baseline gap-1.5 truncate">
            <span className="truncate font-semibold">{item.title}</span>
            {isAgentSource(item.event) && <AgentBadge size={11} className="self-center" />}
            <span className="shrink-0 text-[11px] text-fg-sub">{fmtTime(item.start)}</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <span className="truncate font-semibold">{item.title}</span>
              {isAgentSource(item.event) && <AgentBadge size={11} />}
            </div>
            <div className="truncate text-[11px] text-fg-sub">{time}</div>
            {item.location && h > 62 && (
              <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-fg-sub">
                <MapPin size={10} className="shrink-0" />
                <span className="truncate">{item.location}</span>
              </div>
            )}
          </>
        )}
        <div
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
          onPointerDown={(e) => onDragStart(e, "resize")}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}

function AllDayChip({
  item,
  onOpenEvent,
  onOpenTask,
  onToggleTask,
}: {
  item: CalItem;
  onOpenEvent: (id: string) => void;
  onOpenTask: (id: string) => void;
  onToggleTask: (id: string) => void;
}) {
  if (item.kind === "task") {
    return (
      <div
        className={clsx("flex min-w-0 items-center gap-1 rounded-md border border-dashed px-1 py-0.5 text-[11px]", item.done && "opacity-55")}
        style={{ borderColor: item.color, background: bgOf(item.color, 8) }}
      >
        <Checkbox checked={!!item.done} onChange={() => onToggleTask(item.id)} color={item.color} size={14} aria-label={`Отметить «${item.title}»`} />
        <button type="button" onClick={() => onOpenTask(item.id)} className="min-w-0 flex-1 truncate text-left font-medium">
          <span className="strike" data-done={!!item.done}>
            {item.title}
          </span>
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpenEvent(item.id)}
      className="truncate rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-[11px] font-semibold transition-[filter] hover:brightness-95"
      style={{ borderLeftColor: item.color, background: bgOf(item.color, 14) }}
    >
      {item.title}
    </button>
  );
}
