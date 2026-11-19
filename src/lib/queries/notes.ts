"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Note } from "@/server/services/notes";
import type { NoteCreate, NoteFilters, NoteUpdate } from "@/shared/schemas";
import { invalidate, keys } from "./keys";

export type { Note };

export function useNotes(filters: NoteFilters = {}) {
  return useQuery({
    queryKey: [...keys.notes, "list", filters],
    queryFn: () => api.get<Note[]>("/notes", filters),
  });
}

export function useNote(id: string | null) {
  return useQuery({
    queryKey: [...keys.notes, "detail", id],
    queryFn: () => api.get<Note>(`/notes/${id}`),
    enabled: !!id,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NoteCreate) => api.post<Note>("/notes", input),
    onSuccess: () => invalidate(qc, "notes", "search"),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & NoteUpdate) => api.patch<Note>(`/notes/${id}`, patch),
    onSuccess: () => invalidate(qc, "notes", "search"),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string }>(`/notes/${id}`),
    onSuccess: () => invalidate(qc, "notes", "search"),
  });
}
