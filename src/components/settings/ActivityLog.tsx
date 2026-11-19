"use client";
import Link from "next/link";
import clsx from "clsx";
import { History, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CardHeader } from "@/components/ui/CardHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useActivity, useUndoActivity, type ActivityItem } from "@/lib/queries";
import { ago } from "./utils";

function linkFor(a: ActivityItem): string | null {
  const id = a.entity_id;
  if (!id || a.action === "delete") return null;
  switch (a.entity_type) {
    case "task": return `/tasks?task=${id}`;
    case "project": return `/projects/${id}`;
    case "event": return "/calendar";
    case "note": return `/notes?note=${id}`;
    case "goal": return "/tasks";
    default: return null; // section и прочее — project_id из записи вывести нельзя
  }
}

const ICONS = { create: Plus, update: Pencil, delete: Trash2 } as const;

export function ActivityLog() {
  const q = useActivity({ limit: 15 });
  const undo = useUndoActivity();
  const toast = useToast();
  const items = q.data?.pages.flat() ?? [];

  return (
    <Card className="lg:col-span-2">
      <CardHeader icon={<History />} title="Журнал агентов" subtitle="Что агенты сделали в Ритме — любое действие можно отменить" className="mb-3" />
      {q.isLoading && <Skeleton className="h-16" />}
      {q.error && <p className="text-sm text-danger">Не удалось загрузить журнал: {q.error.message}</p>}
      {!q.isLoading && !q.error && items.length === 0 && <EmptyState compact text="Агенты пока ничего не делали" icon={<History />} />}
      {items.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {items.map((a) => {
            const Icon = ICONS[a.action as keyof typeof ICONS] ?? Pencil;
            const undone = !!a.undone_at;
            const href = linkFor(a);
            return (
              <li key={a.id} className="flex items-start gap-3 py-2.5">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg-sub [&_svg]:size-3.5">
                  <Icon />
                </span>
                <div className={clsx("min-w-0 flex-1", undone && "opacity-55")}>
                  <div className={clsx("break-words text-sm leading-snug", undone && "line-through")}>
                    {href && !undone ? (
                      <Link href={href} className="hover:text-accent hover:underline">{a.summary}</Link>
                    ) : (
                      a.summary
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-fg-sub">
                    {a.token_name ?? "удалённый ключ"} · {ago(a.created_at)}
                    {undone && " · отменено"}
                  </div>
                </div>
                {a.can_undo && !undone && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Undo2 />}
                    disabled={undo.isPending}
                    onClick={() =>
                      undo.mutate(a.id, {
                        onSuccess: () => toast.success("Действие отменено"),
                        onError: (e) => toast.error(e.message),
                      })
                    }
                  >
                    Отменить
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {q.hasNextPage && (
        <Button size="sm" variant="secondary" className="mt-3" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
          Показать ещё
        </Button>
      )}
    </Card>
  );
}
