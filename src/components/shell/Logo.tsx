import { useId } from "react";
import clsx from "clsx";

/** Столбики «ритма»: x и высота в системе координат 32×32, центр по вертикали — 16. */
const BARS = [
  { x: 6.7, h: 8 },
  { x: 11.9, h: 15 },
  { x: 17.1, h: 19 },
  { x: 22.3, h: 11 },
] as const;

/** Знак «Ритм»: плитка акцентного цвета с четырьмя столбиками. Цвет следует за акцентом из настроек. */
export function LogoMark({ size = 30, className }: { size?: number; className?: string }) {
  const gid = useId().replace(/:/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={clsx("shrink-0", className)}
    >
      <defs>
        <linearGradient id={`rm-${gid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "color-mix(in srgb, var(--accent) 82%, white)" }} />
          <stop offset="1" style={{ stopColor: "var(--accent)" }} />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="10" fill={`url(#rm-${gid})`} />
      {BARS.map((b) => (
        <rect key={b.x} x={b.x} y={16 - b.h / 2} width="3" height={b.h} rx="1.5" fill="#fff" />
      ))}
    </svg>
  );
}

/** Знак + надпись. Надпись скрывается в свёрнутом сайдбаре (класс sb-label). */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="sb-label font-brand text-[21px] font-semibold leading-none tracking-[-0.035em] text-fg">
        Ритм
      </span>
    </span>
  );
}
