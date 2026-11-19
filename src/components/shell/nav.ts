import { CalendarDays, FolderKanban, LayoutGrid, ListChecks, NotebookPen, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Обзор", icon: LayoutGrid },
  { href: "/tasks", label: "Задачи", icon: ListChecks },
  { href: "/projects", label: "Проекты", icon: FolderKanban },
  { href: "/calendar", label: "Календарь", icon: CalendarDays },
  { href: "/notes", label: "Заметки", icon: NotebookPen },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
