import { forwardRef } from "react";
import clsx from "clsx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  /** Иконка слева (lucide). */
  icon?: React.ReactNode;
}

export const buttonClasses = (variant: ButtonVariant, size: "sm" | "md") =>
  clsx(
    "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background-color,color,opacity,transform] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
    size === "sm" ? "h-8 px-3.5 text-[13px]" : "h-10 px-[18px] text-sm",
    variant === "primary" && "bg-accent text-white hover:brightness-110",
    variant === "secondary" && "bg-surface-2 text-fg hover:brightness-[0.97] dark:hover:brightness-125",
    variant === "ghost" && "text-fg hover:bg-surface-2",
    variant === "danger" && "bg-danger/10 text-danger hover:bg-danger/15",
  );

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={clsx(buttonClasses(variant, size), className)} {...rest}>
      {icon}
      {children}
    </button>
  );
});
