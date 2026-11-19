import clsx from "clsx";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

interface SegmentedProps<T extends string | number> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  /** Растянуть на всю ширину, сегменты равной ширины. */
  fullWidth?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  size = "md",
  fullWidth,
  className,
  "aria-label": ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={clsx(
        "no-scrollbar inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-surface-2 p-1",
        fullWidth && "flex w-full",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={clsx(
              "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-[background-color,color,box-shadow] duration-150 ease-out [&_svg]:size-3.5",
              size === "sm" ? "h-7 px-3 text-xs" : "h-8 px-3.5 text-[13px]",
              fullWidth && "flex-1",
              active ? "bg-surface text-fg shadow-[0_1px_3px_rgba(16,17,26,0.1)]" : "text-fg-sub hover:text-fg",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
