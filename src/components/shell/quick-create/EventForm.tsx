"use client";
import { useState } from "react";
import { addHours, format } from "date-fns";
import { Checkbox } from "@/components/ui/Checkbox";
import { DateInput } from "@/components/ui/DateInput";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { TimeInput } from "@/components/ui/TimeInput";
import { useToast } from "@/components/ui/Toast";
import { useCreateEvent } from "@/lib/queries";
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "@/lib/ui-constants";
import { EVENT_TYPES, type EventCreate, type EventType } from "@/shared/schemas";
import { FormFooter } from "./FormFooter";

function initialRange(d: Partial<EventCreate>) {
  let start: Date;
  if (d.start_at) start = new Date(d.start_at);
  else {
    start = new Date();
    start.setMinutes(0, 0, 0);
    start = addHours(start, 1);
  }
  const end = d.end_at ? new Date(d.end_at) : addHours(start, 1);
  return { date: format(start, "yyyy-MM-dd"), start: format(start, "HH:mm"), end: format(end, "HH:mm") };
}

export function EventForm({ defaults, onClose }: { defaults: Partial<EventCreate>; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateEvent();
  const init = initialRange(defaults);

  const [title, setTitle] = useState(defaults.title ?? "");
  const [type, setType] = useState<EventType>(defaults.type ?? "meeting");
  const [date, setDate] = useState(init.date);
  const [start, setStart] = useState(init.start);
  const [end, setEnd] = useState(init.end);
  const [allDay, setAllDay] = useState(defaults.all_day ?? false);
  const [location, setLocation] = useState(defaults.location ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    const s = new Date(`${date}T${allDay ? "00:00" : start || "00:00"}`);
    const en = new Date(`${date}T${allDay ? "23:59" : end || start || "00:00"}`);
    if (en < s) {
      setError("Конец раньше начала");
      return;
    }
    setError(null);
    create.mutate(
      {
        ...defaults,
        title: title.trim(),
        type,
        start_at: s.toISOString(),
        end_at: en.toISOString(),
        all_day: allDay,
        location: location.trim(),
      },
      {
        onSuccess: () => {
          toast.success("Событие создано");
          onClose();
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название события" className="h-12 text-base" />
      <Field label="Тип">
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map((t) => (
            <Pill key={t} color={EVENT_TYPE_COLORS[t]} active={type === t} onClick={() => setType(t)}>
              {EVENT_TYPE_LABELS[t]}
            </Pill>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Дата">
          <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Начало">
          <TimeInput value={start} onChange={(e) => setStart(e.target.value)} disabled={allDay} />
        </Field>
        <Field label="Конец">
          <TimeInput value={end} onChange={(e) => setEnd(e.target.value)} disabled={allDay} />
        </Field>
      </div>
      <Checkbox checked={allDay} onChange={setAllDay} size={20} label="Весь день" />
      <Field label="Место">
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Необязательно" />
      </Field>
      <FormFooter onCancel={onClose} disabled={!title.trim() || !date} loading={create.isPending} error={error ?? create.error?.message} />
    </form>
  );
}
