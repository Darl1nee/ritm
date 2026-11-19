"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Search } from "lucide-react";
import { Kbd } from "@/components/ui/Kbd";
import { CreateMenu } from "./CreateMenu";
import { useCommandPalette } from "./command-palette-context";
import { NAV_ITEMS, isActive } from "./nav";

/** Десктоп: плавающая панель «Поиск и команды» + «Создать». Мобильный: таб-бар и круглая кнопка. */
export function BottomBar() {
  const { setOpen } = useCommandPalette();
  const pathname = usePathname();
  return (
    <>
      {/* десктоп */}
      <div
        className="pointer-events-none fixed bottom-6 right-0 z-30 hidden justify-center md:flex"
        style={{ left: "var(--sidebar-w)" }}
      >
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-surface p-2 shadow-pop ring-1 ring-line">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-11 w-[300px] items-center gap-2.5 rounded-full bg-surface-2 px-4 text-sm text-fg-sub transition-colors duration-150 hover:text-fg"
          >
            <Search size={16} />
            <span className="flex-1 text-left">Поиск и команды</span>
            <Kbd>⌘ K</Kbd>
          </button>
          <CreateMenu />
        </div>
      </div>

      {/* мобильный */}
      <div className="fixed bottom-[76px] right-4 z-30 md:hidden">
        <CreateMenu round />
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-line bg-surface px-2 pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex h-11 w-14 items-center justify-center rounded-2xl transition-colors duration-150",
                active ? "bg-accent-soft text-accent" : "text-fg-sub",
              )}
            >
              <Icon size={22} strokeWidth={1.75} />
            </Link>
          );
        })}
      </nav>
    </>
  );
}
