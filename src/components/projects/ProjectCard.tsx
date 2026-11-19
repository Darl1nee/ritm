import Link from "next/link";
import clsx from "clsx";
import { CalendarDays } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { Project } from "@/lib/queries";
import { PROJECT_TYPE_INFO } from "@/lib/ui-constants";
import { STATUS_LABELS, STATUS_TONE, projectOverdue, shortDate, soft } from "./utils";

function taskWord(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "задачи";
  return "задач";
}

export function ProjectCard({ project: p }: { project: Project }) {
  const info = PROJECT_TYPE_INFO[p.type];
  const late = projectOverdue(p);
  return (
    <Link
      href={`/projects/${p.id}`}
      className="group flex flex-col gap-4 rounded-card bg-surface p-5 shadow-card transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-pop"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-xl"
          style={{ background: soft(p.color, "26") }}
          aria-hidden
        >
          {p.emoji || info.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold leading-snug">{p.title}</h3>
          <p className="text-xs text-fg-sub">{info.label}</p>
        </div>
        {p.status !== "active" && (
          <span className={clsx("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium", STATUS_TONE[p.status])}>
            {STATUS_LABELS[p.status]}
          </span>
        )}
      </div>
      <p className="line-clamp-2 min-h-[2.5rem] text-[13px] leading-5 text-fg-sub">{p.description || "Без описания"}</p>
      <div className="flex flex-col gap-2">
        <ProgressBar value={p.progress.percent} color={p.color} />
        <div className="flex items-center justify-between gap-2 text-xs tabular-nums text-fg-sub">
          <span>
            {p.progress.done} из {p.progress.total} {taskWord(p.progress.total)}
          </span>
          {p.due_date && (
            <span className={clsx("inline-flex items-center gap-1", late && "font-medium text-danger")}>
              <CalendarDays size={13} />
              до {shortDate(p.due_date)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
