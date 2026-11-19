"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface Api {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
}
const Ctx = createContext<Api | null>(null);

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo(() => ({ open, setOpen, toggle }), [open, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** `const { setOpen } = useCommandPalette(); setOpen(true)` — открыть палитру. */
export function useCommandPalette(): Api {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCommandPalette вне CommandPaletteProvider");
  return c;
}
