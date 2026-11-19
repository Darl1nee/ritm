"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Settings, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { FocusTimer } from "./FocusTimer";
import { useCommandPalette } from "./command-palette-context";

function dateLabel(d: Date) {
  const s = format(d, "EEEEEE, d MMM", { locale: ru }).replace(".", "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Часы, «Спросить» и таймер фокуса. Выводится справа в строке PageHeader. */
export function TopBar() {
  const [now, setNow] = useState<Date | null>(null);
  const { setOpen } = useCommandPalette();

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="hidden h-11 items-center gap-3 rounded-full bg-surface px-4 shadow-card sm:flex">
        <span className="text-[15px] font-semibold">
          {now ? format(now, "HH") : "--"}
          <span className="blink mx-px">:</span>
          {now ? format(now, "mm") : "--"}
        </span>
        <span className="h-4 w-px bg-line" />
        <span className="min-w-[78px] text-[13px] text-fg-sub">{now ? dateLabel(now) : ""}</span>
      </div>
      <Button variant="secondary" icon={<Sparkles />} onClick={() => setOpen(true)} className="h-11 bg-surface shadow-card max-sm:hidden">
        Спросить
      </Button>
      <IconButton label="Поиск и команды" variant="secondary" onClick={() => setOpen(true)} className="bg-surface shadow-card sm:hidden">
        <Sparkles />
      </IconButton>
      <FocusTimer />
      <Link
        href="/settings"
        aria-label="Настройки"
        className="inline-flex size-10 items-center justify-center rounded-full bg-surface text-fg-sub shadow-card md:hidden"
      >
        <Settings size={18} />
      </Link>
    </div>
  );
}
