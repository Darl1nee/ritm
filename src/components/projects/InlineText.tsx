"use client";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

interface InlineTextProps {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  /** Пустое значение допустимо (описание). */
  allowEmpty?: boolean;
  className?: string;
  inputClassName?: string;
  "aria-label": string;
}

/** Текст, который по клику превращается в поле. Enter/blur — сохранить, Esc — отмена. */
export function InlineText({
  value,
  onSave,
  placeholder,
  multiline,
  allowEmpty,
  className,
  inputClassName,
  "aria-label": ariaLabel,
}: InlineTextProps) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => setV(value), [value]);
  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const t = v.trim();
    if (t === value.trim()) return setV(value);
    if (!t && !allowEmpty) return setV(value);
    onSave(t);
  };

  if (editing) {
    const common = {
      ref,
      value: v,
      "aria-label": ariaLabel,
      placeholder,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV(e.target.value),
      onBlur: commit,
      className: clsx("w-full min-w-0 rounded-field bg-surface-2 px-2.5 py-1 outline-none ring-2 ring-accent/40", inputClassName),
    };
    return multiline ? (
      <textarea
        {...common}
        rows={2}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setV(value);
            setEditing(false);
          } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            commit();
          }
        }}
      />
    ) : (
      <input
        {...common}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setV(value);
            setEditing(false);
          } else if (e.key === "Enter") commit();
        }}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={ariaLabel}
      className={clsx("-mx-2.5 min-w-0 max-w-full cursor-text rounded-field px-2.5 py-1 text-left transition-colors duration-150 hover:bg-surface-2", className)}
    >
      {value || <span className="text-fg-sub">{placeholder}</span>}
    </button>
  );
}
