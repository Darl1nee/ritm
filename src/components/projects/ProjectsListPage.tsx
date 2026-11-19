"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useQuickCreate } from "@/components/shell";
import { useDebounced } from "@/lib/hooks/use-debounced";
import { useProjects } from "@/lib/queries";
import { PROJECT_TYPE_INFO } from "@/lib/ui-constants";
import { PROJECT_TYPES, type ProjectType } from "@/shared/schemas";
import { ProjectCard } from "./ProjectCard";
import { useUrlParams } from "./url-state";

type TypeFilter = "all" | ProjectType;
type StatusFilter = "open" | "active" | "paused" | "done" | "archived";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "open", label: "Активные и на паузе" },
  { value: "active", label: "Активные" },
  { value: "paused", label: "На паузе" },
  { value: "done", label: "Завершённые" },
  { value: "archived", label: "Архив" },
];

export function ProjectsListPage() {
  const { sp, set } = useUrlParams();
  const { open } = useQuickCreate();
  const { data, isLoading, error } = useProjects();

  const rawType = sp.get("type");
  const type: TypeFilter = PROJECT_TYPES.includes(rawType as ProjectType) ? (rawType as ProjectType) : "all";
  const rawStatus = sp.get("status");
  const status: StatusFilter = STATUS_OPTIONS.some((o) => o.value === rawStatus) ? (rawStatus as StatusFilter) : "open";
  const urlQ = sp.get("q") ?? "";

  const [q, setQ] = useState(urlQ);
  const debouncedQ = useDebounced(q, 250);
  useEffect(() => {
    if (debouncedQ !== urlQ) set({ q: debouncedQ || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const filtered = useMemo(() => {
    const needle = urlQ.trim().toLowerCase();
    return (data ?? []).filter((p) => {
      if (type !== "all" && p.type !== type) return false;
      if (status === "open" ? p.status !== "active" && p.status !== "paused" : p.status !== status) return false;
      if (needle && !`${p.title} ${p.description}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data, type, status, urlQ]);

  const create = () => open("project");

  return (
    <>
      <PageHeader
        title="Проекты"
        actions={
          <Button variant="primary" icon={<Plus />} onClick={create}>
            Новый проект
          </Button>
        }
      />

      {!isLoading && data && data.length === 0 ? (
        <Card className="mx-auto flex max-w-xl flex-col items-center gap-5 py-10 text-center md:py-12">
          <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-2xl">🗂️</span>
          <div>
            <h2 className="text-lg font-semibold">Проектов пока нет</h2>
            <p className="mt-1 text-sm text-fg-sub">Соберите задачи, заметки и сроки вокруг большого дела.</p>
          </div>
          <ul className="grid w-full grid-cols-1 gap-2 text-left sm:grid-cols-2">
            {PROJECT_TYPES.map((t) => (
              <li key={t} className="flex items-start gap-3 rounded-2xl bg-surface-2 p-3">
                <span className="text-xl">{PROJECT_TYPE_INFO[t].emoji}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{PROJECT_TYPE_INFO[t].label}</span>
                  <span className="block text-xs text-fg-sub">{PROJECT_TYPE_INFO[t].description}</span>
                </span>
              </li>
            ))}
          </ul>
          <Button variant="primary" icon={<Plus />} onClick={create}>
            Создать проект
          </Button>
        </Card>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-sub" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Поиск по названию"
                aria-label="Поиск проектов"
                className="pl-10"
              />
            </div>
            <Segmented<TypeFilter>
              aria-label="Тип проекта"
              value={type}
              onChange={(v) => set({ type: v === "all" ? null : v })}
              options={[
                { value: "all", label: "Все" },
                ...PROJECT_TYPES.map((t) => ({ value: t, label: PROJECT_TYPE_INFO[t].label })),
              ]}
            />
            <Select
              aria-label="Статус"
              value={status}
              onChange={(e) => set({ status: e.target.value === "open" ? null : e.target.value })}
              className="w-full sm:w-56"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>

          {isLoading ? (
            <Grid>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-52 rounded-card" />
              ))}
            </Grid>
          ) : error ? (
            <EmptyState text="Не удалось загрузить проекты" />
          ) : filtered.length === 0 ? (
            <EmptyState text="Ничего не найдено — измените фильтры или создайте проект" onClick={create} />
          ) : (
            <Grid>
              {filtered.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </Grid>
          )}
        </>
      )}
    </>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}
