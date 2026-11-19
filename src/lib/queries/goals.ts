"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Goal } from "@/server/services/goals";
import type { GoalCreate, GoalUpdate } from "@/shared/schemas";
import { invalidate, keys } from "./keys";

export type { Goal };

export function useGoals() {
  return useQuery({ queryKey: [...keys.goals, "list"], queryFn: () => api.get<Goal[]>("/goals") });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GoalCreate) => api.post<Goal>("/goals", input),
    onSuccess: () => invalidate(qc, "goals"),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & GoalUpdate) => api.patch<Goal>(`/goals/${id}`, patch),
    onSuccess: () => invalidate(qc, "goals"),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string }>(`/goals/${id}`),
    onSuccess: () => invalidate(qc, "goals", "tasks"),
  });
}
