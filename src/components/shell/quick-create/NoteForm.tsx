"use client";
import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useCreateNote } from "@/lib/queries";
import type { NoteCreate } from "@/shared/schemas";
import { FormFooter } from "./FormFooter";

export function NoteForm({ defaults, onClose }: { defaults: Partial<NoteCreate>; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateNote();
  const [title, setTitle] = useState(defaults.title ?? "");
  const [kind, setKind] = useState<"note" | "idea">(defaults.kind ?? "note");
  const [body, setBody] = useState(defaults.body ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !body.trim()) return;
    create.mutate(
      { ...defaults, title: title.trim(), kind, body },
      {
        onSuccess: () => {
          toast.success(kind === "idea" ? "Идея сохранена" : "Заметка создана");
          onClose();
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок" className="h-12 text-base" />
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: "note", label: "Заметка" },
          { value: "idea", label: "Идея" },
        ]}
      />
      <Field label="Текст">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Markdown поддерживается" />
      </Field>
      <FormFooter onCancel={onClose} disabled={!title.trim() && !body.trim()} loading={create.isPending} error={create.error?.message} />
    </form>
  );
}
