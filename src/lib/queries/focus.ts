"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FocusSession, FocusToday } from "@/server/services/focus";
import type { FocusCreate } from "@/shared/schemas";
import { invalidate, keys } from "./keys";

export type { FocusSession, FocusToday };

export function useFocusToday() {
  return useQuery({ queryKey: [...keys.focus, "today"], queryFn: () => api.get<FocusToday>("/focus/today") });
}

export function useFocusList(range: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: [...keys.focus, "list", range],
    queryFn: () => api.get<FocusSession[]>("/focus", range),
  });
}

/** Записать завершённую фокус-сессию. */
export function useCreateFocus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FocusCreate) => api.post<FocusSession>("/focus", input),
    onSuccess: () => invalidate(qc, "focus", "overview"),
  });
}
