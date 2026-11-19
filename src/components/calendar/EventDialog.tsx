"use client";
import { useState } from "react";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DateInput } from "@/components/ui/DateInput";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { Textarea } from "@/components/ui/Textarea";
import { TimeInput } from "@/components/ui/TimeInput";
import { useToast } from "@/components/ui/Toast";
import { useDeleteEvent, useUpdateEvent, type CalendarEvent } from "@/lib/queries";
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "@/lib/ui-constants";
import { EVENT_TYPES, type EventType } from "@/shared/schemas";

export function EventDialog({ event, onClose }: { event: CalendarEvent | null; onClose: () => void }) {
  return (
    <Modal open={!!event} onClose={onClose} title="Событие" width={500}>
      {event && <EventEditor key={event.id} event={event} onClose={onClose} />}
    </Modal>
  );
}

function EventEditor({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  const toast = useToast();
  const update = useUpdateEvent();
  const del = useDeleteEvent();
  const s0 = new Date(event.start_at);
  const e0 = new Date(event.end_at);
  const dayDiff = Math.max(0, differenceInCalendarDays(e0, s0));

  const [title, setTitle] = useState(event.title);
  const [type, setType] = useState<EventType>(event.type);
  const [date, setDate] = useState(format(s0, "yyyy-MM-dd"));
  const [start, setStart] = useState(format(s0, "HH:mm"));
  const [end, setEnd] = useState(format(e0, "HH:mm"));
  const [allDay, setAllDay] = useState(event.all_day);
  const [location, setLocation] = useState(event.location);
  const [notes, setNotes] = useState(event.notes);
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    const endDate = format(addDays(new Date(`${date}T00:00`), dayDiff), "yyyy-MM-dd");
    const s = new Date(`${date}T${allDay ? "00:00" : start || "00:00"}`);
    const en = new Date(`${endDate}T${allDay ? "23:59" : end || start || "00:00"}`);
    if (en < s) {
      setError("Конец раньше начала");
      return;
    }
    setError(null);
    update.mutate(
      {
        id: event.id,
        title: title.trim(),
        type,
        start_at: s.toISOString(),
        end_at: en.toISOString(),
        all_day: allDay,
        location: location.trim(),
        notes,
      },
      {
        onSuccess: () => {
          toast.success("Сохранено");
          onClose();
        },
      },
    );
  };

  const remove = () => {
    del.mutate(event.id, {
      onSuccess: () => {
        toast.success("Событие удалено");
        onClose();
      },
    });
  };

  const err = error ?? update.error?.message ?? del.error?.message;

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название события" className="h-12 text-base" />
      <Field label="Тип">
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map((t) => (
            <Pill key={t} color={EVENT_TYPE_COLORS[t]} active={type === t} onClick={() => setType(t)}>
              {EVENT_TYPE_LABELS[t]}
            </Pill>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-3">
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
      {dayDiff > 0 && <p className="-mt-2 text-xs text-fg-sub">Событие длится несколько дней — число дней сохранится.</p>}
      <Checkbox checked={allDay} onChange={setAllDay} size={20} label="Весь день" />
      <Field label="Место">
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Необязательно" />
      </Field>
      <Field label="Заметки">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Необязательно" />
      </Field>
      {err && <p className="text-sm text-danger">{err}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {confirmDel ? (
          <div className="flex items-center gap-2">
            <Button variant="danger" size="sm" onClick={remove} disabled={del.isPending}>
              Да, удалить
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDel(false)}>
              Нет
            </Button>
          </div>
        ) : (
          <Button variant="danger" size="sm" onClick={() => setConfirmDel(true)}>
            Удалить
          </Button>
        )}
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" disabled={!title.trim() || !date || update.isPending}>
            Сохранить
          </Button>
        </div>
      </div>
    </form>
  );
}
