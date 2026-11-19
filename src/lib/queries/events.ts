"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CalendarEvent } from "@/server/services/events";
import type { EventCreate, EventRange, EventUpdate } from "@/shared/schemas";
import { invalidate, keys } from "./keys";

export type { CalendarEvent };

export function useEvents(range: EventRange) {
  return useQuery({
    queryKey: [...keys.events, "list", range],
    queryFn: () => api.get<CalendarEvent[]>("/events", range),
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EventCreate) => api.post<CalendarEvent>("/events", input),
    onSuccess: () => invalidate(qc, "events", "overview", "search"),
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & EventUpdate) =>
      api.patch<CalendarEvent>(`/events/${id}`, patch),
    onSuccess: () => invalidate(qc, "events", "overview", "search"),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string }>(`/events/${id}`),
    onSuccess: () => invalidate(qc, "events", "overview", "search"),
  });
}
