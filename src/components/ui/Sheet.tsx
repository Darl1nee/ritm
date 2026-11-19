"use client";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { X } from "lucide-react";
import { useOverlay } from "./use-overlay";
import { IconButton } from "./IconButton";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** Слот справа от заголовка (например, кнопка удаления). */
  actions?: React.ReactNode;
  /** Ширина панели в px (по умолчанию 440). */
  width?: number;
  className?: string;
  children: React.ReactNode;
}

/** Боковая панель справа (редактирование задачи, заметки). */
export function Sheet({ open, onClose, title, actions, width = 440, className, children }: SheetProps) {
  const ref = useOverlay(open, onClose);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="anim-fade fixed inset-0 z-50 flex justify-end bg-[var(--overlay)] backdrop-blur-[4px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={clsx("anim-slide-in flex h-full w-full flex-col bg-surface text-fg shadow-pop outline-none sm:rounded-l-[24px]", className)}
        style={{ maxWidth: width }}
      >
        <div className="flex items-center justify-between gap-3 px-6 pb-2 pt-5">
          <h2 className="min-w-0 truncate text-lg font-semibold">{title}</h2>
          <div className="flex items-center gap-1">
            {actions}
            <IconButton label="Закрыть" size="sm" onClick={onClose}>
              <X />
            </IconButton>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
