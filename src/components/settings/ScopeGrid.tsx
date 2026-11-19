"use client";
import clsx from "clsx";
import { SCOPE_GROUPS, ALL_SCOPES, READ_ONLY_SCOPES, type Scope } from "@/server/mcp/scopes";
import { Pill } from "@/components/ui/Pill";
import { GROUP_IDS } from "./utils";

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150",
        checked ? "bg-accent" : "bg-line",
      )}
    >
      <span
        className={clsx(
          "absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-150",
          checked && "translate-x-4",
        )}
      />
    </button>
  );
}

/** Сетка прав: строка на раздел, переключатели «Чтение» / «Запись» + пресеты. */
export function ScopeGrid({ value, onChange }: { value: Scope[]; onChange: (s: Scope[]) => void }) {
  const toggle = (scope: Scope, on: boolean) => {
    const set = new Set(value);
    if (on) set.add(scope);
    else set.delete(scope);
    onChange(ALL_SCOPES.filter((s) => set.has(s)));
  };
  const writeOnly = GROUP_IDS.some((g) => value.includes(`${g}:write`) && !value.includes(`${g}:read`));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Pill size="sm" onClick={() => onChange([...READ_ONLY_SCOPES])}>Только чтение</Pill>
        <Pill size="sm" onClick={() => onChange([...ALL_SCOPES])}>Полный доступ</Pill>
        <Pill size="sm" onClick={() => onChange([])}>Снять всё</Pill>
      </div>
      <div className="rounded-field bg-surface-2 px-3 py-1">
        <div className="flex items-center gap-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-fg-sub">
          <span className="flex-1">Раздел</span>
          <span className="w-[52px] text-center">Чтение</span>
          <span className="w-[52px] text-center">Запись</span>
        </div>
        {GROUP_IDS.map((g) => (
          <div key={g} className="flex items-center gap-4 border-t border-line py-2">
            <span className="min-w-0 flex-1 text-sm">{SCOPE_GROUPS[g]}</span>
            <span className="flex w-[52px] justify-center">
              <Switch
                checked={value.includes(`${g}:read`)}
                onChange={(v) => toggle(`${g}:read`, v)}
                label={`${SCOPE_GROUPS[g]}: чтение`}
              />
            </span>
            <span className="flex w-[52px] justify-center">
              <Switch
                checked={value.includes(`${g}:write`)}
                onChange={(v) => toggle(`${g}:write`, v)}
                label={`${SCOPE_GROUPS[g]}: запись`}
              />
            </span>
          </div>
        ))}
      </div>
      {writeOnly && (
        <p className="text-xs text-fg-sub">Запись без чтения разрешена, но агенту обычно нужно и чтение — иначе он не увидит, что менять.</p>
      )}
    </div>
  );
}
