import { forwardRef } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { fieldClasses } from "./Input";

/** Нативный select в стиле полей. Опции передаются как <option> в children. */
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <div className={clsx("relative", className)}>
      <select ref={ref} className={clsx(fieldClasses, "h-10 cursor-pointer appearance-none pr-9")} {...rest}>
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-sub" />
    </div>
  );
});
