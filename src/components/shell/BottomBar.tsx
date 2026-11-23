"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { motion } from "motion/react";
import { Search } from "lucide-react";
import { Kbd } from "@/components/ui/Kbd";
import { CreateMenu } from "./CreateMenu";
import { useCommandPalette } from "./command-palette-context";
import { NAV_ITEMS, isActive } from "./nav";

/** Десктоп: стеклянная панель «Поиск и команды» + «Создать». Мобильный: парящий стеклянный dock. */
export function BottomBar() {
  const { setOpen } = useCommandPalette();
  const pathname = usePathname();

  return (
    <>
      {/* Десктоп */}
      <div
        className="pointer-events-none fixed bottom-6 right-0 z-30 hidden justify-center md:flex"
        style={{ left: "var(--sidebar-w)" }}
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="pointer-events-auto flex items-center gap-2.5 rounded-full apple-dock p-2 shadow-pop"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-11 w-[300px] items-center gap-2.5 rounded-full bg-surface/50 px-4 text-sm text-fg-sub transition-colors duration-150 hover:text-fg hover:bg-surface/80"
          >
            <Search size={16} />
            <span className="flex-1 text-left">Поиск и команды</span>
            <Kbd>⌘ K</Kbd>
          </motion.button>
          <CreateMenu />
        </motion.div>
      </div>

      {/* Мобильный: плавающая кнопка создания */}
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+86px)] right-4 z-30 md:hidden">
        <CreateMenu round />
      </div>

      {/* Мобильный: парящий стеклянный Dock в стиле iOS */}
      <nav className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] z-30 mx-auto flex h-[64px] max-w-lg items-center justify-around rounded-[28px] apple-dock px-1.5 md:hidden">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className="relative flex h-[52px] w-14 flex-col items-center justify-center rounded-2xl"
            >
              {active && (
                <motion.span
                  layoutId="active-mobile-tab-pill"
                  className="absolute inset-0 rounded-2xl bg-accent-soft apple-glass-pill"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <motion.div
                whileTap={{ scale: 0.82 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className={clsx(
                  "relative z-10 flex flex-col items-center justify-center gap-0.5 transition-colors duration-150",
                  active ? "text-accent" : "text-fg-sub",
                )}
              >
                <Icon size={21} strokeWidth={active ? 2.25 : 1.75} />
                <span className="text-[10px] font-medium tracking-tight">{label}</span>
              </motion.div>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
