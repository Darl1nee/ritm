import { forwardRef } from "react";
import clsx from "clsx";
import { fieldClasses } from "./Input";

/** Нативный выбор времени. value/onChange — строка HH:MM (или ""). */
export const TimeInput = forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(
  function TimeInput({ className, ...rest }, ref) {
    return <input ref={ref} type="time" className={clsx(fieldClasses, "h-10 min-w-0", className)} {...rest} />;
  },
);
