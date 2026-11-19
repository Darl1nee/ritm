import clsx from "clsx";

interface ProgressBarProps {
  /** 0–100. */
  value: number;
  color?: string;
  height?: number;
  className?: string;
  /** Для карточек на цветном фоне. */
  onColor?: boolean;
}

export function ProgressBar({ value, color, height = 6, className, onColor }: ProgressBarProps) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={clsx("w-full overflow-hidden rounded-full", onColor ? "bg-white/25" : "bg-surface-2", className)}
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300 ease-out"
        style={{ width: `${v}%`, background: onColor ? "#fff" : (color ?? "var(--accent)") }}
      />
    </div>
  );
}
