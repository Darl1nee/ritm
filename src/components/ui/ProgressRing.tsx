interface ProgressRingProps {
  /** 0–100. */
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  /** Содержимое по центру (иконка, число). */
  children?: React.ReactNode;
  className?: string;
}

export function ProgressRing({
  value,
  size = 36,
  stroke = 3.5,
  color = "var(--accent)",
  trackColor = "var(--surface-2)",
  children,
  className,
}: ProgressRingProps) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <span className={className} style={{ position: "relative", display: "inline-flex", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - v / 100)}
          style={{ transition: "stroke-dashoffset 400ms ease-out" }}
        />
      </svg>
      {children && <span className="absolute inset-0 flex items-center justify-center">{children}</span>}
    </span>
  );
}
