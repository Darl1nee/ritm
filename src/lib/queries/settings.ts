"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Settings, SettingsUpdate } from "@/shared/schemas";
import { invalidate, keys } from "./keys";

export type { Settings };

export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: () => api.get<Settings>("/settings") });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SettingsUpdate) => api.patch<Settings>("/settings", patch),
    onSuccess: (data) => {
      qc.setQueryData(keys.settings, data);
      return invalidate(qc, "overview", "focus");
    },
  });
}
