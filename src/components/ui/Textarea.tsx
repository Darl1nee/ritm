import { forwardRef } from "react";
import clsx from "clsx";
import { fieldClasses } from "./Input";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 4, ...rest }, ref) {
    return <textarea ref={ref} rows={rows} className={clsx(fieldClasses, "resize-none py-2.5 leading-relaxed", className)} {...rest} />;
  },
);
