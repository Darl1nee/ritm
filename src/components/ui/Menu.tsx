"use client";
import clsx from "clsx";
import { Popover } from "./Popover";

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  /** Подсказка справа (например, <Kbd>). */
  hint?: React.ReactNode;
}

interface MenuProps {
  trigger: React.ReactNode;
  items: (MenuItem | "divider")[];
  align?: "start" | "end";
  side?: "bottom" | "top";
  className?: string;
}

/** Выпадающее меню действий. */
export function Menu({ trigger, items, align, side, className }: MenuProps) {
  return (
    <Popover trigger={trigger} align={align} side={side} className={className}>
      {(close) => (
        <div role="menu" className="flex flex-col">
          {items.map((it, i) =>
            it === "divider" ? (
              <div key={i} className="my-1 h-px bg-line" />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  it.onSelect();
                }}
                className={clsx(
                  "flex h-9 items-center gap-2.5 rounded-xl px-3 text-left text-sm transition-colors duration-150 hover:bg-surface-2 [&_svg]:size-4 [&_svg]:shrink-0",
                  it.danger ? "text-danger" : "text-fg [&_svg]:text-fg-sub",
                )}
              >
                {it.icon}
                <span className="flex-1">{it.label}</span>
                {it.hint}
              </button>
            ),
          )}
        </div>
      )}
    </Popover>
  );
}
