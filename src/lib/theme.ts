import type { Settings } from "@/shared/schemas";

export type Theme = Settings["theme"];
export const THEME_KEY = "ritm.theme";
export const ACCENT_KEY = "ritm.accent";
export const SIDEBAR_KEY = "ritm.sidebar";
export const DEFAULT_ACCENT = "#2e5eff";
export const DARK_DEFAULT_ACCENT = "#4b74ff";

export function resolveTheme(theme: Theme, systemDark: boolean): "light" | "dark" {
  return theme === "system" ? (systemDark ? "dark" : "light") : theme;
}

/** Применяет тему и акцент к <html>. */
export function applyTheme(theme: Theme, accent: string): "light" | "dark" {
  const root = document.documentElement;
  const resolved = resolveTheme(theme, window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = resolved;
  const a = resolved === "dark" && accent.toLowerCase() === DEFAULT_ACCENT ? DARK_DEFAULT_ACCENT : accent;
  root.style.setProperty("--accent", a);
  return resolved;
}

/**
 * Inline-скрипт для <head>: ставит тему, акцент и состояние сайдбара до первой отрисовки.
 * Логика дублирует applyTheme (скрипт выполняется до загрузки бандла).
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var d=document.documentElement,t=null,a=null,s=null;
try{t=localStorage.getItem('${THEME_KEY}');a=localStorage.getItem('${ACCENT_KEY}');s=localStorage.getItem('${SIDEBAR_KEY}');}catch(e){}
if(t!=='light'&&t!=='dark'&&t!=='system')t='system';
var r=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;
d.setAttribute('data-theme',r);d.style.colorScheme=r;
if(!a||!/^#[0-9a-fA-F]{6}$/.test(a))a='${DEFAULT_ACCENT}';
if(r==='dark'&&a.toLowerCase()==='${DEFAULT_ACCENT}')a='${DARK_DEFAULT_ACCENT}';
d.style.setProperty('--accent',a);
if(s==='1')d.setAttribute('data-sidebar','collapsed');
}catch(e){}})();`;
