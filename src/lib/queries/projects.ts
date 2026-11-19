"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Project, ProjectDetail } from "@/server/services/projects";
import type { Section } from "@/server/services/sections";
import type {
  ProjectCreate,
  ProjectFilters,
  ProjectUpdate,
  SectionCreate,
  SectionUpdate,
} from "@/shared/schemas";
import { invalidate, keys } from "./keys";

export type { Project, ProjectDetail, Section };

export function useProjects(filters: ProjectFilters = {}) {
  return useQuery({
    queryKey: [...keys.projects, "list", filters],
    queryFn: () => api.get<Project[]>("/projects", filters),
  });
}

export function useProject(id: string | null) {
  return useQuery({
    queryKey: [...keys.projects, "detail", id],
    queryFn: () => api.get<ProjectDetail>(`/projects/${id}`),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectCreate) => api.post<ProjectDetail>("/projects", input),
    onSuccess: () => invalidate(qc, "projects", "overview", "search"),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & ProjectUpdate) =>
      api.patch<ProjectDetail>(`/projects/${id}`, patch),
    onSuccess: () => invalidate(qc, "projects", "overview", "search"),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string }>(`/projects/${id}`),
    // удаляются задачи проекта, отвязываются заметки и события
    onSuccess: () => invalidate(qc, "projects", "tasks", "goals", "notes", "events", "overview", "search"),
  });
}

export function useCreateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...input }: { projectId: string } & SectionCreate) =>
      api.post<Section>(`/projects/${projectId}/sections`, input),
    onSuccess: () => invalidate(qc, "projects"),
  });
}

export function useUpdateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & SectionUpdate) => api.patch<Section>(`/sections/${id}`, patch),
    onSuccess: () => invalidate(qc, "projects"),
  });
}

export function useDeleteSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string }>(`/sections/${id}`),
    onSuccess: () => invalidate(qc, "projects", "tasks"),
  });
}
