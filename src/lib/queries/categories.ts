"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Category } from "@/server/services/categories";
import type { CategoryCreate, CategoryUpdate } from "@/shared/schemas";
import { invalidate, keys } from "./keys";

export type { Category };

export function useCategories() {
  return useQuery({ queryKey: [...keys.categories, "list"], queryFn: () => api.get<Category[]>("/categories") });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CategoryCreate) => api.post<Category>("/categories", input),
    onSuccess: () => invalidate(qc, "categories"),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & CategoryUpdate) =>
      api.patch<Category>(`/categories/${id}`, patch),
    onSuccess: () => invalidate(qc, "categories"),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string }>(`/categories/${id}`),
    onSuccess: () => invalidate(qc, "categories", "tasks", "goals"),
  });
}
