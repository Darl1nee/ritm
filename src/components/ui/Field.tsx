import clsx from "clsx";

interface FieldProps {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

/** Подпись над контролом формы (12px, fg-sub). */
export function Field({ label, hint, className, children }: FieldProps) {
  return (
    <div className={clsx("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="px-0.5 text-xs font-medium text-fg-sub">{label}</span>
      {children}
      {hint && <span className="px-0.5 text-xs text-fg-sub">{hint}</span>}
    </div>
  );
}
