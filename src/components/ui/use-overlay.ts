"use client";
import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

let lockCount = 0;

/** Общая механика оверлеев: Esc, фокус-ловушка, возврат фокуса, блокировка прокрутки. */
export function useOverlay(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    lockCount++;
    document.body.style.overflow = "hidden";

    const node = ref.current;
    // автофокус на первый контрол, если фокус ещё не внутри
    const t = setTimeout(() => {
      if (node && !node.contains(document.activeElement)) {
        const first = node.querySelector<HTMLElement>(FOCUSABLE);
        (first ?? node).focus();
      }
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !node.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !node.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      lockCount--;
      if (lockCount <= 0) document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open]);

  return ref;
}
