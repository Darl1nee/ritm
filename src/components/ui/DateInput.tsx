import { forwardRef } from "react";
import clsx from "clsx";
import { fieldClasses } from "./Input";

/** Нативный выбор даты. value/onChange — строка YYYY-MM-DD (или ""). */
export const DateInput = forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(
  function DateInput({ className, ...rest }, ref) {
    return <input ref={ref} type="date" className={clsx(fieldClasses, "h-10 min-w-0", className)} {...rest} />;
  },
);
