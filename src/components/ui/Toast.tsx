"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleAlert, CircleCheck } from "lucide-react";

type Kind = "default" | "success" | "error";
interface ToastItem {
  id: number;
  message: string;
  kind: Kind;
}
interface ToastApi {
  show: (message: string, opts?: { kind?: Kind; duration?: number }) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const idRef = useRef(0);

  const show = useCallback<ToastApi["show"]>((message, opts) => {
    const id = ++idRef.current;
    setItems((l) => [...l.slice(-3), { id, message, kind: opts?.kind ?? "default" }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), opts?.duration ?? 3200);
  }, []);
  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m) => show(m, { kind: "success" }),
      error: (m) => show(m, { kind: "error", duration: 5000 }),
    }),
    [show],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 bottom-36 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-28"
          >
            {items.map((t) => (
              <div
                key={t.id}
                className="anim-toast pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-full bg-fg px-4 py-2.5 text-[13px] font-medium text-bg shadow-pop"
              >
                {t.kind === "success" && <CircleCheck size={16} className="text-success" />}
                {t.kind === "error" && <CircleAlert size={16} className="text-danger" />}
                {t.message}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  );
}

/** `const toast = useToast(); toast.success("Готово"); toast.error("Ошибка"); toast.show("Текст")`. */
export function useToast(): ToastApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast вне ToastProvider");
  return c;
}
