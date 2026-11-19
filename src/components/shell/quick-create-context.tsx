"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { EventCreate, GoalCreate, NoteCreate, ProjectCreate, TaskCreate } from "@/shared/schemas";

export type QuickCreateKind = "task" | "event" | "note" | "project" | "goal";

/** Значения по умолчанию для каждой модалки. Применяются при открытии. */
export interface QuickCreateDefaults {
  task: Partial<TaskCreate>;
  event: Partial<EventCreate>;
  note: Partial<NoteCreate>;
  project: Partial<ProjectCreate>;
  goal: Partial<GoalCreate>;
}

export interface QuickCreateState {
  kind: QuickCreateKind;
  defaults: QuickCreateDefaults[QuickCreateKind];
  /** Счётчик открытий — ключ для сброса состояния формы. */
  nonce: number;
}

interface Api {
  state: QuickCreateState | null;
  open: <K extends QuickCreateKind>(kind: K, defaults?: QuickCreateDefaults[K]) => void;
  close: () => void;
}

const Ctx = createContext<Api | null>(null);

export function QuickCreateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<QuickCreateState | null>(null);
  const open = useCallback<Api["open"]>((kind, defaults) => {
    setState((s) => ({ kind, defaults: defaults ?? {}, nonce: (s?.nonce ?? 0) + 1 }));
  }, []);
  const close = useCallback(() => setState(null), []);
  const value = useMemo(() => ({ state, open, close }), [state, open, close]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** `const { open } = useQuickCreate(); open("task", { bucket: "week" })`. */
export function useQuickCreate(): Api {
  const c = useContext(Ctx);
  if (!c) throw new Error("useQuickCreate вне QuickCreateProvider");
  return c;
}
