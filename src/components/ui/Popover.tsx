"use client";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { motion, AnimatePresence } from "motion/react";

interface PopoverProps {
  /** Элемент-триггер (кнопка). Клик по нему открывает/закрывает поповер. */
  trigger: React.ReactNode;
  /** Содержимое; можно передать функцию, чтобы получить close(). */
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: "start" | "end";
  side?: "bottom" | "top";
  /** Контролируемое состояние (необязательно). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  panelClassName?: string;
}

export function Popover({
  trigger,
  children,
  align = "start",
  side = "bottom",
  open: openProp,
  onOpenChange,
  className,
  panelClassName,
}: PopoverProps) {
  const [inner, setInner] = useState(false);
  const open = openProp ?? inner;
  const rootRef = useRef<HTMLDivElement>(null);
  const setOpen = (v: boolean) => {
    setInner(v);
    onOpenChange?.(v);
  };
  const setOpenRef = useRef(setOpen);
  useEffect(() => {
    setOpenRef.current = setOpen;
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenRef.current(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenRef.current(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={clsx("relative inline-flex", className)}>
      <div className="inline-flex" onClick={() => setOpen(!open)} aria-expanded={open}>
        {trigger}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: side === "bottom" ? -8 : 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: side === "bottom" ? -4 : 4 }}
            transition={{ type: "spring", stiffness: 450, damping: 28 }}
            className={clsx(
              "absolute z-40 min-w-[200px] rounded-2xl apple-glass p-1.5 text-fg shadow-pop",
              side === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
              align === "end" ? "right-0" : "left-0",
              panelClassName,
            )}
          >
            {typeof children === "function" ? children(() => setOpen(false)) : children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
