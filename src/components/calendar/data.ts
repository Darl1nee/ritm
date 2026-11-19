"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { invalidate, keys, type CalendarEvent, type Task } from "@/lib/queries";
import type { EventUpdate } from "@/shared/schemas";
import { ymd } from "./utils";

/** События и задачи диапазона. Ключи совпадают с useEvents/useTasks; при смене диапазона остаются прежние данные. */
export function useRangeData(from: Date, to: Date) {
  const range = { from: ymd(from), to: ymd(to) };
  const events = useQuery({
    queryKey: [...keys.events, "list", range],
    queryFn: () => api.get<CalendarEvent[]>("/events", range),
    placeholderData: keepPreviousData,
  });
  const tasks = useQuery({
    queryKey: [...keys.tasks, "list", range],
    queryFn: () => api.get<Task[]>("/tasks", range),
    placeholderData: keepPreviousData,
  });
  return {
    events: events.data,
    tasks: tasks.data,
    loading: events.data === undefined || tasks.data === undefined,
    error: events.error ?? tasks.error,
  };
}

/** Оптимистичное обновление события (перетаскивание/растягивание): откат и тост при ошибке. */
export function useMoveEvent() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & EventUpdate) =>
      api.patch<CalendarEvent>(`/events/${id}`, patch),
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: keys.events });
      const snapshot = qc.getQueriesData({ queryKey: keys.events });
      qc.setQueriesData({ queryKey: keys.events }, (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return (old as CalendarEvent[]).map((e) =>
          e.id === id
            ? {
                ...e,
                ...(patch.start_at ? { start_at: new Date(patch.start_at).toISOString() } : {}),
                ...(patch.end_at ? { end_at: new Date(patch.end_at).toISOString() } : {}),
              }
            : e,
        );
      });
      return { snapshot };
    },
    onError: (e, _v, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(e instanceof Error ? `Не удалось сохранить: ${e.message}` : "Не удалось сохранить событие");
    },
    onSettled: () => invalidate(qc, "events", "overview", "search"),
  });
}

/** Текущее время, обновляется раз в минуту. null до монтирования (без рассинхрона гидрации). */
export function useNow(intervalMs = 60_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Совпадает ли media-запрос (на сервере false). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
