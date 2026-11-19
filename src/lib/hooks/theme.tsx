"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSettings, useUpdateSettings } from "@/lib/queries";
import { readStorage, writeStorage } from "@/lib/storage";
import { ACCENT_KEY, DEFAULT_ACCENT, THEME_KEY, applyTheme, type Theme } from "@/lib/theme";

interface ThemeCtx {
  theme: Theme;
  resolved: "light" | "dark";
  accent: string;
  setTheme: (t: Theme) => void;
  setAccent: (hex: string) => void;
  toggleTheme: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

function initialTheme(): Theme {
  const t = typeof window === "undefined" ? null : readStorage(THEME_KEY);
  return t === "light" || t === "dark" || t === "system" ? t : "system";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data } = useSettings();
  const update = useUpdateSettings();
  const [theme, setThemeState] = useState<Theme>("system");
  const [accent, setAccentState] = useState(DEFAULT_ACCENT);
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  // Значения из localStorage (то же, что применил inline-скрипт).
  useEffect(() => {
    setThemeState(initialTheme());
    const a = readStorage(ACCENT_KEY);
    if (a && /^#[0-9a-fA-F]{6}$/.test(a)) setAccentState(a);
  }, []);

  // Серверные настройки — источник истины.
  useEffect(() => {
    if (!data) return;
    setThemeState(data.theme);
    setAccentState(data.accent);
    writeStorage(THEME_KEY, data.theme);
    writeStorage(ACCENT_KEY, data.accent);
  }, [data]);

  useEffect(() => {
    setResolved(applyTheme(theme, accent));
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(applyTheme(theme, accent));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme, accent]);

  const setTheme = useCallback(
    (t: Theme) => {
      setThemeState(t);
      writeStorage(THEME_KEY, t);
      update.mutate({ theme: t });
    },
    [update],
  );
  const setAccent = useCallback(
    (hex: string) => {
      setAccentState(hex);
      writeStorage(ACCENT_KEY, hex);
      update.mutate({ accent: hex });
    },
    [update],
  );
  const toggleTheme = useCallback(() => setTheme(resolved === "dark" ? "light" : "dark"), [resolved, setTheme]);

  const value = useMemo(
    () => ({ theme, resolved, accent, setTheme, setAccent, toggleTheme }),
    [theme, resolved, accent, setTheme, setAccent, toggleTheme],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme вне ThemeProvider");
  return c;
}
