import clsx from "clsx";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Цвет заливки в выполненном состоянии (по умолчанию accent). */
  color?: string;
  size?: number;
  disabled?: boolean;
  /** Текстовая подпись справа (необязательно). */
  label?: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}

/** Круглый чекбокс задачи: заполнение кружка и «рисующаяся» галочка. */
export function Checkbox({
  checked,
  onChange,
  color,
  size = 22,
  disabled,
  label,
  className,
  "aria-label": ariaLabel,
}: CheckboxProps) {
  const c = color ?? "var(--accent)";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={clsx("inline-flex shrink-0 items-center gap-2 text-sm", className)}
    >
      <span
        className="relative inline-flex items-center justify-center rounded-full border-[1.75px] transition-[background-color,border-color,transform] duration-200 ease-out active:scale-90"
        style={{
          width: size,
          height: size,
          borderColor: checked ? c : "var(--fg-sub)",
          background: checked ? c : "transparent",
        }}
      >
        <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="none" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            style={{
              strokeDasharray: 24,
              strokeDashoffset: checked ? 0 : 24,
              transition: "stroke-dashoffset 200ms ease-out 40ms",
            }}
          />
        </svg>
      </span>
      {label}
    </button>
  );
}
