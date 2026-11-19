"use client";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { X } from "lucide-react";
import { useOverlay } from "./use-overlay";
import { IconButton } from "./IconButton";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** Ширина панели в px (по умолчанию 520). */
  width?: number;
  className?: string;
  children: React.ReactNode;
}

/** Модальное окно: блюр-оверлей, Esc, клик по фону, фокус-ловушка. */
export function Modal({ open, onClose, title, width = 520, className, children }: ModalProps) {
  const ref = useOverlay(open, onClose);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-[var(--overlay)] p-0 backdrop-blur-[6px] sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={clsx(
          "anim-pop flex max-h-[92dvh] w-full flex-col rounded-t-[24px] bg-surface text-fg shadow-pop outline-none sm:rounded-[24px]",
          className,
        )}
        style={{ maxWidth: width }}
      >
        {title && (
          <div className="flex items-center justify-between gap-3 px-6 pb-2 pt-5">
            <h2 className="text-lg font-semibold">{title}</h2>
            <IconButton label="Закрыть" size="sm" onClick={onClose}>
              <X />
            </IconButton>
          </div>
        )}
        <div className="overflow-y-auto px-6 pb-6 pt-2">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
