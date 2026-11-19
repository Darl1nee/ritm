import clsx from "clsx";

interface CardHeaderProps {
  /** Иконка (lucide) — рисуется в круглой пилюле слева. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Слот справа (кнопка, ссылка). */
  action?: React.ReactNode;
  /** `onColor` — для заголовков внутри accent/peach карточек. */
  tone?: "default" | "onColor";
  className?: string;
}

export function CardHeader({ icon, title, subtitle, action, tone = "default", className }: CardHeaderProps) {
  const onColor = tone === "onColor";
  return (
    <div className={clsx("flex items-center gap-3", className)}>
      {icon && (
        <span
          className={clsx(
            "flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-[18px]",
            onColor ? "bg-white/20 text-white" : "bg-surface-2 text-fg",
          )}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold leading-tight">{title}</div>
        {subtitle && (
          <div className={clsx("truncate text-[12px]", onColor ? "text-white/75" : "text-fg-sub")}>{subtitle}</div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
