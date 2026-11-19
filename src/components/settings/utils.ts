import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { SCOPE_GROUPS, type Scope, type ScopeGroup } from "@/server/mcp/scopes";

export function ago(iso: string): string {
  try {
    return formatDistanceToNowStrict(parseISO(iso), { locale: ru, addSuffix: true });
  } catch {
    return "";
  }
}

export const GROUP_IDS = Object.keys(SCOPE_GROUPS) as ScopeGroup[];

/** Права → чипы по разделам: «Задачи и категории: чтение и запись». */
export function scopeSummary(scopes: readonly Scope[]): string[] {
  const out: string[] = [];
  for (const g of GROUP_IDS) {
    const r = scopes.includes(`${g}:read`);
    const w = scopes.includes(`${g}:write`);
    if (!r && !w) continue;
    out.push(`${SCOPE_GROUPS[g]}: ${r && w ? "чтение и запись" : r ? "чтение" : "запись"}`);
  }
  return out;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
