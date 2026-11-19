"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SearchResult } from "@/server/services/search";
import { keys } from "./keys";

export type { SearchResult };

export function useSearch(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: [...keys.search, query],
    queryFn: () => api.get<{ query: string; results: SearchResult[] }>("/search", { q: query }),
    enabled: query.length > 0,
    staleTime: 10_000,
  });
}
