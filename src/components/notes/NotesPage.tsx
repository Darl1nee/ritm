"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDebounced } from "@/lib/hooks/use-debounced";
import { useCreateNote, useNotes, useProjects } from "@/lib/queries";
import { useUrlParams } from "@/components/projects/url-state";
import { NoteCard } from "./NoteCard";
import { NoteEditorSheet } from "./NoteEditor";

type Kind = "note" | "idea";

export function NotesPage() {
  const { sp, set } = useUrlParams();
  const kind: Kind = sp.get("kind") === "idea" ? "idea" : "note";
  const urlQ = sp.get("q") ?? "";
  const noteId = sp.get("note");

  const [q, setQ] = useState(urlQ);
  const debouncedQ = useDebounced(q, 250);
  useEffect(() => {
    if (debouncedQ !== urlQ) set({ q: debouncedQ || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const { data, isLoading, error } = useNotes({ kind, q: urlQ.trim() || undefined });
  const { data: projects } = useProjects();
  const projectById = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);
  const create = useCreateNote();

  const pinned = (data ?? []).filter((n) => n.pinned);
  const rest = (data ?? []).filter((n) => !n.pinned);

  const open = (id: string) => set({ note: id });
  const createNote = () =>
    create.mutate({ kind, title: "", body: "" }, { onSuccess: (n) => set({ note: n.id }) });

  const noun = kind === "idea" ? "идей" : "заметок";
  const isSearch = urlQ.trim().length > 0;

  return (
    <>
      <PageHeader
        title="Заметки"
        actions={
          <Button variant="primary" icon={<Plus />} onClick={createNote} disabled={create.isPending}>
            Новая заметка
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented<Kind>
          aria-label="Раздел"
          value={kind}
          onChange={(v) => set({ kind: v === "note" ? null : v })}
          options={[
            { value: "note", label: "Заметки" },
            { value: "idea", label: "Идеи" },
          ]}
        />
        <div className="relative w-full sm:w-72">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-sub" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Поиск по ${kind === "idea" ? "идеям" : "заметкам"}`}
            aria-label="Поиск"
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <Grid>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-44 rounded-card" />
          ))}
        </Grid>
      ) : error ? (
        <EmptyState text="Не удалось загрузить" />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          text={isSearch ? "Ничего не найдено" : kind === "idea" ? "Идей пока нет — запишите первую" : "Заметок пока нет — создайте первую"}
          onClick={isSearch ? undefined : createNote}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {pinned.length > 0 && (
            <section aria-label="Закреплённые">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-fg-sub">Закреплённые</h2>
              <Grid>
                {pinned.map((n) => (
                  <NoteCard key={n.id} note={n} project={n.project_id ? projectById.get(n.project_id) : undefined} onOpen={open} />
                ))}
              </Grid>
            </section>
          )}
          <section aria-label={`Все ${noun}`}>
            {pinned.length > 0 && <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-fg-sub">Остальные</h2>}
            <Grid>
              {!isSearch && (
                <button
                  type="button"
                  onClick={createNote}
                  className="flex min-h-[176px] flex-col items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-line text-sm text-fg-sub transition-colors duration-150 hover:border-accent/50 hover:text-accent"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-surface-2">
                    <Plus size={16} />
                  </span>
                  Создать
                </button>
              )}
              {rest.map((n) => (
                <NoteCard key={n.id} note={n} project={n.project_id ? projectById.get(n.project_id) : undefined} onOpen={open} />
              ))}
            </Grid>
          </section>
        </div>
      )}

      <NoteEditorSheet noteId={noteId} onClose={() => set({ note: null })} />
    </>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}
