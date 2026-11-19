import { forwardRef } from "react";
import clsx from "clsx";

export const fieldClasses =
  "w-full rounded-field bg-surface-2 px-3.5 text-sm text-fg placeholder:text-fg-sub outline-none transition-shadow duration-150 ease-out focus:ring-2 focus:ring-accent/40 disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, type = "text", ...rest },
  ref,
) {
  return <input ref={ref} type={type} className={clsx(fieldClasses, "h-10", className)} {...rest} />;
});
