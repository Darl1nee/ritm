import clsx from "clsx";

/** Заглушка загрузки. Размер задаётся классами: <Skeleton className="h-4 w-32" />. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("skeleton rounded-xl", className)} />;
}
