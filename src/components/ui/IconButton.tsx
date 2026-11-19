import { forwardRef } from "react";
import clsx from "clsx";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Обязателен: aria-label и подсказка. */
  label: string;
  size?: "sm" | "md";
  variant?: "ghost" | "secondary" | "primary" | "danger";
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "md", variant = "ghost", active, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 ease-out active:scale-95 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
        size === "sm" ? "size-8 [&_svg]:size-4" : "size-10 [&_svg]:size-[18px]",
        variant === "ghost" && (active ? "bg-accent-soft text-accent" : "text-fg-sub hover:bg-surface-2 hover:text-fg"),
        variant === "secondary" && "bg-surface-2 text-fg hover:brightness-[0.97] dark:hover:brightness-125",
        variant === "primary" && "bg-accent text-white hover:brightness-110",
        variant === "danger" && "text-fg-sub hover:bg-danger/10 hover:text-danger",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
