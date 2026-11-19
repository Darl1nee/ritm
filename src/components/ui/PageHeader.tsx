"use client";
import { createContext, useContext } from "react";
import clsx from "clsx";

const TopBarSlotContext = createContext<React.ReactNode>(null);

/** Оболочка кладёт сюда <TopBar/>, PageHeader показывает его справа в своей строке. */
export const TopBarSlotProvider = TopBarSlotContext.Provider;

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Слот справа (кнопки страницы); TopBar выводится правее. */
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  const topBar = useContext(TopBarSlotContext);
  return (
    <header className={clsx("flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pb-6 pt-5 md:pt-7", className)}>
      <div className="min-w-0">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.01em]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-fg-sub">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {actions}
        {topBar}
      </div>
    </header>
  );
}
