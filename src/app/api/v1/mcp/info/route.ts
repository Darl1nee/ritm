import { api } from "@/server/http";
import { ALL_SCOPES, SCOPE_GROUPS, type ScopeGroup, type ScopeLevel } from "@/server/mcp/scopes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEVEL_LABEL: Record<ScopeLevel, string> = { read: "Чтение", write: "Запись" };

export const GET = api((req) => ({
  url: `${new URL(req.url).origin}/api/mcp`,
  groups: (Object.keys(SCOPE_GROUPS) as ScopeGroup[]).map((id) => ({ id, label: SCOPE_GROUPS[id] })),
  scopes: ALL_SCOPES.map((id) => {
    const [group, level] = id.split(":") as [ScopeGroup, ScopeLevel];
    return { id, group, level, label: LEVEL_LABEL[level] };
  }),
}));
