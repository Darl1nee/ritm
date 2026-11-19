"use client";
import { CalendarPlus, CircleCheck, FolderPlus, NotebookPen, Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { useQuickCreate } from "./quick-create-context";

/** Кнопка «+ Создать» с меню (Задача, Событие, Заметка, Проект, Цель). */
export function CreateMenu({ round, side = "top" }: { round?: boolean; side?: "top" | "bottom" }) {
  const { open } = useQuickCreate();
  const items: MenuItem[] = [
    { label: "Задача", icon: <CircleCheck />, onSelect: () => open("task") },
    { label: "Событие", icon: <CalendarPlus />, onSelect: () => open("event") },
    { label: "Заметка", icon: <NotebookPen />, onSelect: () => open("note") },
    { label: "Проект", icon: <FolderPlus />, onSelect: () => open("project") },
    { label: "Цель", icon: <Target />, onSelect: () => open("goal") },
  ];
  return (
    <Menu
      side={side}
      align="end"
      items={items}
      trigger={
        round ? (
          <button
            type="button"
            aria-label="Создать"
            className="flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-pop transition-transform duration-150 active:scale-95"
          >
            <Plus size={26} />
          </button>
        ) : (
          <Button variant="primary" icon={<Plus />} className="h-11 px-5 shadow-pop">
            Создать
          </Button>
        )
      }
    />
  );
}
