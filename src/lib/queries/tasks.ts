"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Task, TaskWithSubtasks } from "@/server/services/tasks";
import type { TaskCreate, TaskFilters, TaskReorder, TaskUpdate } from "@/shared/schemas";
import { invalidate, keys } from "./keys";

export type { Task, TaskWithSubtasks };

export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: [...keys.tasks, "list", filters],
    queryFn: () => api.get<Task[]>("/tasks", filters),
  });
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: [...keys.tasks, "detail", id],
    queryFn: () => api.get<TaskWithSubtasks>(`/tasks/${id}`),
    enabled: !!id,
  });
}

// Задачи влияют на проекты (прогресс), цели, обзор и поиск.
const refresh = (qc: ReturnType<typeof useQueryClient>) =>
  invalidate(qc, "tasks", "projects", "goals", "overview", "search");

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskCreate) => api.post<TaskWithSubtasks>("/tasks", input),
    onSuccess: () => refresh(qc),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & TaskUpdate) =>
      api.patch<TaskWithSubtasks>(`/tasks/${id}`, patch),
    onSuccess: () => refresh(qc),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string }>(`/tasks/${id}`),
    onSuccess: () => refresh(qc),
  });
}

/** Переключение выполнения — оптимистично: кэш списков и деталей обновляется сразу. */
export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<TaskWithSubtasks>(`/tasks/${id}/toggle`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: keys.tasks });
      const snapshot = qc.getQueriesData({ queryKey: keys.tasks });
      const flip = (t: Task): Task => {
        if (t.id !== id) return t;
        const done = !t.done;
        return { ...t, done, completed_at: done ? new Date().toISOString() : null };
      };
      qc.setQueriesData({ queryKey: keys.tasks }, (old: unknown) => {
        if (Array.isArray(old)) return (old as Task[]).map(flip);
        if (old && typeof old === "object" && "id" in old) {
          const d = old as TaskWithSubtasks;
          return { ...flip(d), subtasks: d.subtasks.map(flip) };
        }
        return old;
      });
      return { snapshot };
    },
    onError: (_e, _id, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => refresh(qc),
  });
}

export function useReorderTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: TaskReorder) => api.post<{ updated: number }>("/tasks/reorder", items),
    onSuccess: () => refresh(qc),
  });
}
