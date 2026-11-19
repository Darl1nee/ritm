import clsx from "clsx";
import { Plus } from "lucide-react";

interface EmptyStateProps {
  text: string;
  /** Если задан — рамка кликабельна (кнопка). */
  onClick?: () => void;
  icon?: React.ReactNode;
  className?: string;
  /** Компактный вариант для колонок и списков. */
  compact?: boolean;
}

/** Пустое состояние: пунктирная рамка, «+» и короткий текст. */
export function EmptyState({ text, onClick, icon, className, compact }: EmptyStateProps) {
  const cls = clsx(
    "flex w-full flex-col items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-line text-center text-sm text-fg-sub transition-colors duration-150 ease-out",
    compact ? "px-4 py-5" : "px-6 py-10",
    onClick && "hover:border-accent/50 hover:text-accent",
    className,
  );
  const inner = (
    <>
      <span className="flex size-8 items-center justify-center rounded-full bg-surface-2 [&_svg]:size-4">{icon ?? <Plus />}</span>
      <span>{text}</span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
