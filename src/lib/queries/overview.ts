"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Overview, DayLoad } from "@/server/services/overview";
import { keys } from "./keys";

export type { Overview, DayLoad };

export function useOverview() {
  return useQuery({ queryKey: keys.overview, queryFn: () => api.get<Overview>("/overview") });
}
