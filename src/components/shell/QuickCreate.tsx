"use client";
import { Modal } from "@/components/ui/Modal";
import { useQuickCreate, type QuickCreateDefaults, type QuickCreateKind } from "./quick-create-context";
import { EventForm } from "./quick-create/EventForm";
import { GoalForm } from "./quick-create/GoalForm";
import { NoteForm } from "./quick-create/NoteForm";
import { ProjectForm } from "./quick-create/ProjectForm";
import { TaskForm } from "./quick-create/TaskForm";

const TITLES: Record<QuickCreateKind, string> = {
  task: "Новая задача",
  event: "Новое событие",
  note: "Новая заметка",
  project: "Новый проект",
  goal: "Новая цель",
};

/** Хост модалок быстрого создания. Открывается через useQuickCreate().open(kind, defaults). */
export function QuickCreate() {
  const { state, close } = useQuickCreate();
  const key = state ? `${state.kind}-${state.nonce}` : "none";
  return (
    <Modal open={!!state} onClose={close} title={state ? TITLES[state.kind] : undefined} width={state?.kind === "project" ? 560 : 520}>
      {state?.kind === "task" && <TaskForm key={key} defaults={state.defaults as QuickCreateDefaults["task"]} onClose={close} />}
      {state?.kind === "event" && <EventForm key={key} defaults={state.defaults as QuickCreateDefaults["event"]} onClose={close} />}
      {state?.kind === "note" && <NoteForm key={key} defaults={state.defaults as QuickCreateDefaults["note"]} onClose={close} />}
      {state?.kind === "project" && <ProjectForm key={key} defaults={state.defaults as QuickCreateDefaults["project"]} onClose={close} />}
      {state?.kind === "goal" && <GoalForm key={key} defaults={state.defaults as QuickCreateDefaults["goal"]} onClose={close} />}
    </Modal>
  );
}
