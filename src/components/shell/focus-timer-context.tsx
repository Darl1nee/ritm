"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useCreateFocus, useSettings } from "@/lib/queries";
import { readStorage, writeStorage } from "@/lib/storage";
import { useToast } from "@/components/ui/Toast";

const KEY = "ritm.focus";

interface Stored {
  status: "running" | "paused";
  lengthSec: number;
  /** ISO старта сессии. */
  startedAt: string;
  /** Накопленные мс до текущего запуска. */
  elapsedBeforeMs: number;
  /** Timestamp (мс) начала текущего запуска; null если на паузе. */
  runStartedAt: number | null;
  taskId: string | null;
}

export interface FocusTimerApi {
  status: "idle" | "running" | "paused";
  lengthMin: number;
  remainingSec: number;
  /** 0–100 */
  progress: number;
  start: (opts?: { taskId?: string | null }) => void;
  pause: () => void;
  resume: () => void;
  /** Остановить: сессия ≥ 1 минуты записывается, короче — отбрасывается. */
  stop: () => void;
}

const Ctx = createContext<FocusTimerApi | null>(null);

function elapsedMs(s: Stored, now: number) {
  return s.elapsedBeforeMs + (s.runStartedAt ? now - s.runStartedAt : 0);
}

function load(): Stored | null {
  const raw = readStorage(KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Stored;
    if ((s.status === "running" || s.status === "paused") && typeof s.lengthSec === "number" && s.startedAt) return s;
  } catch {
    /* повреждённые данные */
  }
  return null;
}

export function FocusTimerProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useSettings();
  const createFocus = useCreateFocus();
  const toast = useToast();
  const [state, setState] = useState<Stored | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const finishing = useRef(false);

  const lengthMin = settings?.focus_length_min ?? 25;

  const persist = useCallback((s: Stored | null) => {
    setState(s);
    writeStorage(KEY, s ? JSON.stringify(s) : null);
  }, []);

  // восстановление после перезагрузки
  useEffect(() => {
    setState(load());
  }, []);

  const record = useCallback(
    (s: Stored, ms: number, completed: boolean) => {
      const minutes = completed ? Math.round(s.lengthSec / 60) : Math.round(ms / 60000);
      if (minutes < 1) return;
      createFocus.mutate(
        {
          started_at: s.startedAt,
          ended_at: new Date().toISOString(),
          duration_min: minutes,
          task_id: s.taskId,
        },
        {
          onSuccess: () =>
            toast.success(completed ? `Фокус завершён: ${minutes} мин` : `Сессия сохранена: ${minutes} мин`),
          onError: (e) => toast.error(e.message),
        },
      );
    },
    [createFocus, toast],
  );

  // тик
  useEffect(() => {
    if (!state || state.status !== "running") return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [state]);

  // завершение по истечении времени
  useEffect(() => {
    if (!state || state.status !== "running" || finishing.current) return;
    const t = Date.now();
    if (elapsedMs(state, t) >= state.lengthSec * 1000) {
      finishing.current = true;
      record(state, state.lengthSec * 1000, true);
      persist(null);
      finishing.current = false;
    }
  }, [state, now, record, persist]);

  const start = useCallback<FocusTimerApi["start"]>(
    (opts) => {
      const t = Date.now();
      setNow(t);
      persist({
        status: "running",
        lengthSec: lengthMin * 60,
        startedAt: new Date(t).toISOString(),
        elapsedBeforeMs: 0,
        runStartedAt: t,
        taskId: opts?.taskId ?? null,
      });
    },
    [lengthMin, persist],
  );
  const pause = useCallback(() => {
    if (!state || state.status !== "running") return;
    persist({ ...state, status: "paused", elapsedBeforeMs: elapsedMs(state, Date.now()), runStartedAt: null });
  }, [state, persist]);
  const resume = useCallback(() => {
    if (!state || state.status !== "paused") return;
    const t = Date.now();
    setNow(t);
    persist({ ...state, status: "running", runStartedAt: t });
  }, [state, persist]);
  const stop = useCallback(() => {
    if (!state) return;
    record(state, elapsedMs(state, Date.now()), false);
    persist(null);
  }, [state, record, persist]);

  const value = useMemo<FocusTimerApi>(() => {
    if (!state) {
      return { status: "idle", lengthMin, remainingSec: lengthMin * 60, progress: 0, start, pause, resume, stop };
    }
    const el = elapsedMs(state, now);
    const total = state.lengthSec * 1000;
    return {
      status: state.status,
      lengthMin: Math.round(state.lengthSec / 60),
      remainingSec: Math.max(0, Math.ceil((total - el) / 1000)),
      progress: Math.min(100, (el / total) * 100),
      start,
      pause,
      resume,
      stop,
    };
  }, [state, now, lengthMin, start, pause, resume, stop]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFocusTimer(): FocusTimerApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("useFocusTimer вне FocusTimerProvider");
  return c;
}
