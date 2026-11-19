import clsx from "clsx";

export type CardVariant = "default" | "accent" | "peach";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Внутренний отступ 20/24px. По умолчанию true. */
  padded?: boolean;
}

export function Card({ variant = "default", padded = true, className, children, ...rest }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-card shadow-card",
        variant === "default" && "bg-surface text-fg",
        variant === "accent" && "card-accent",
        variant === "peach" && "card-peach",
        padded && "p-5 md:p-6",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
