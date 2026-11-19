"use client";
import { Pause, Play, Square } from "lucide-react";
import clsx from "clsx";
import { IconButton } from "@/components/ui/IconButton";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { useFocusTimer } from "./focus-timer-context";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function FocusTimer({ className }: { className?: string }) {
  const t = useFocusTimer();
  const running = t.status === "running";
  const idle = t.status === "idle";
  return (
    <div className={clsx("flex h-11 items-center gap-2.5 rounded-full bg-surface pl-1.5 pr-1.5 shadow-card", className)}>
      <ProgressRing value={t.progress} size={32} stroke={3.5} />
      <div className="flex flex-col leading-none">
        <span className="text-[11px] text-fg-sub">Фокус</span>
        <span className="mt-0.5 text-[14px] font-semibold">{fmt(t.remainingSec)}</span>
      </div>
      <div className="flex items-center">
        <IconButton
          label={running ? "Пауза" : idle ? "Начать фокус" : "Продолжить"}
          size="sm"
          variant={running ? "secondary" : "primary"}
          onClick={() => (running ? t.pause() : idle ? t.start() : t.resume())}
        >
          {running ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
        </IconButton>
        {!idle && (
          <IconButton label="Остановить" size="sm" onClick={t.stop}>
            <Square fill="currentColor" className="!size-3" />
          </IconButton>
        )}
      </div>
    </div>
  );
}
