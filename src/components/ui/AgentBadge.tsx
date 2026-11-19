import clsx from "clsx";
import { Sparkles } from "lucide-react";

/** true, если у сущности `source === "agent"` (безопасно, даже если поля нет в типе). */
export function isAgentSource(x: unknown): boolean {
  return !!x && typeof x === "object" && "source" in x && (x as { source?: unknown }).source === "agent";
}

/** Маленькая пометка «добавлено ИИ-агентом». Ничего не рендерит, если `show` ложно. */
export function AgentBadge({ show = true, size = 13, className }: { show?: boolean; size?: number; className?: string }) {
  if (!show) return null;
  return (
    <span
      className={clsx("inline-flex shrink-0 items-center text-accent", className)}
      title="Добавлено ИИ-агентом"
      aria-label="Добавлено ИИ-агентом"
      role="img"
    >
      <Sparkles size={size} />
    </span>
  );
}
