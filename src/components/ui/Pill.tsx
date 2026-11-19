import clsx from "clsx";

interface PillProps {
  active?: boolean;
  /** Цвет точки слева. */
  color?: string;
  /** Иконка слева. */
  icon?: React.ReactNode;
  /** Если задан onClick — рендерится кнопка, иначе span. */
  onClick?: () => void;
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
  title?: string;
}

/** Чип/пилюля: фильтры, категории, типы. Активный — акцентная заливка. */
export function Pill({ active, color, icon, onClick, size = "md", className, children, title }: PillProps) {
  const cls = clsx(
    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-colors duration-150 ease-out [&_svg]:size-3.5",
    size === "sm" ? "h-7 px-3 text-xs" : "h-9 px-3.5 text-[13px]",
    active ? "bg-accent-soft text-accent" : "bg-surface-2 text-fg-sub",
    onClick && !active && "hover:text-fg",
    className,
  );
  const inner = (
    <>
      {color && <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />}
      {icon}
      {children}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cls} aria-pressed={!!active} title={title}>
      {inner}
    </button>
  ) : (
    <span className={cls} title={title}>
      {inner}
    </span>
  );
}

export { Pill as Chip };
