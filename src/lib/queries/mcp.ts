"use client";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ScopeGroup, ScopeLevel, Scope } from "@/server/mcp/scopes";
import type { McpToken } from "@/server/services/mcp-tokens";
import { keys } from "./keys";

export type { McpToken };

export interface McpInfo {
  url: string;
  groups: { id: ScopeGroup; label: string }[];
  scopes: { id: Scope; group: ScopeGroup; level: ScopeLevel; label: string }[];
}

export interface ActivityItem {
  id: string;
  token_id: string | null;
  token_name: string | null;
  tool: string;
  entity_type: string;
  entity_id: string | null;
  action: "create" | "update" | "delete" | string;
  summary: string;
  created_at: string;
  undone_at: string | null;
  can_undo: boolean;
}

export function useMcpInfo() {
  return useQuery({ queryKey: [...keys.mcp, "info"], queryFn: () => api.get<McpInfo>("/mcp/info"), staleTime: 60_000 });
}

export function useMcpTokens() {
  return useQuery({ queryKey: [...keys.mcp, "tokens"], queryFn: () => api.get<McpToken[]>("/mcp/tokens") });
}

export function useCreateMcpToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; scopes: Scope[] }) =>
      api.post<{ token: string; record: McpToken }>("/mcp/tokens", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.mcp }),
  });
}

export function useUpdateMcpToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name?: string; scopes?: Scope[] }) =>
      api.patch<McpToken>(`/mcp/tokens/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.mcp }),
  });
}

export function useRevokeMcpToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<McpToken>(`/mcp/tokens/${id}/revoke`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.mcp }),
  });
}

export function useDeleteMcpToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: true }>(`/mcp/tokens/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.mcp }),
  });
}

/** Журнал действий агентов; «Показать ещё» — fetchNextPage (курсор `before` = id последней записи). */
export function useActivity({ limit = 20 }: { limit?: number } = {}) {
  return useInfiniteQuery({
    queryKey: [...keys.activity, "list", limit],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.get<ActivityItem[]>("/activity", { limit, before: pageParam }),
    getNextPageParam: (last) => (last.length >= limit ? last[last.length - 1].id : undefined),
  });
}

export function useUndoActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<ActivityItem>(`/activity/${id}/undo`),
    // Отмена может менять любые сущности — сбрасываем весь кэш.
    onSuccess: () => qc.invalidateQueries(),
  });
}
