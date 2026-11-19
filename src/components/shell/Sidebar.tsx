"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { useOverview } from "@/lib/queries";
import { readStorage, writeStorage } from "@/lib/storage";
import { SIDEBAR_KEY } from "@/lib/theme";
import { NAV_ITEMS, isActive } from "./nav";
import { Logo } from "./Logo";

function itemClasses(active: boolean) {
  return clsx(
    "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors duration-150 ease-out [&_svg]:shrink-0",
    active ? "bg-accent-soft text-accent" : "text-fg-sub hover:bg-surface-2 hover:text-fg",
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data } = useOverview();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(document.documentElement.getAttribute("data-sidebar") === "collapsed" || readStorage(SIDEBAR_KEY) === "1");
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (next) document.documentElement.setAttribute("data-sidebar", "collapsed");
    else document.documentElement.removeAttribute("data-sidebar");
    writeStorage(SIDEBAR_KEY, next ? "1" : "0");
  };

  const todayOpen = data ? Math.max(0, data.tasks_today.total - data.tasks_today.done) : 0;

  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface px-3 pb-4 pt-6 transition-[width] duration-200 ease-out md:flex"
      style={{ width: "var(--sidebar-w)" }}
    >
      <Link href="/" className="mb-7 flex h-9 items-center px-2.5" aria-label="Ритм — на главную">
        <Logo />
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          const badge = href === "/tasks" && todayOpen > 0 ? todayOpen : 0;
          return (
            <Link key={href} href={href} title={label} aria-current={active ? "page" : undefined} className={itemClasses(active)}>
              <Icon size={18} strokeWidth={1.75} />
              <span className="sb-label flex-1 truncate">{label}</span>
              {badge > 0 && (
                <span className="sb-label rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-white">{badge}</span>
              )}
              {badge > 0 && (
                <span className="absolute right-2 top-2 hidden size-2 rounded-full bg-accent [html[data-sidebar=collapsed]_&]:block" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1">
        <Link href="/settings" title="Настройки" className={itemClasses(isActive(pathname, "/settings"))}>
          <Settings size={18} strokeWidth={1.75} />
          <span className="sb-label">Настройки</span>
        </Link>
        <button type="button" onClick={toggle} title={collapsed ? "Развернуть" : "Свернуть"} className={itemClasses(false)}>
          {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.75} /> : <PanelLeftClose size={18} strokeWidth={1.75} />}
          <span className="sb-label">Свернуть</span>
        </button>
      </div>
    </aside>
  );
}
