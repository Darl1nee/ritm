import clsx from "clsx";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={clsx(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-surface-2 px-1.5 font-sans text-[11px] font-medium text-fg-sub",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
