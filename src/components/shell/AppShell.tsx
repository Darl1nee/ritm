"use client";
import { TopBarSlotProvider } from "@/components/ui/PageHeader";
import { BottomBar } from "./BottomBar";
import { CommandPalette } from "./CommandPalette";
import { CommandPaletteProvider } from "./command-palette-context";
import { FocusTimerProvider } from "./focus-timer-context";
import { QuickCreate } from "./QuickCreate";
import { QuickCreateProvider } from "./quick-create-context";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/** Оболочка приложения: сайдбар, контент, нижняя панель, палитра и модалки создания. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <FocusTimerProvider>
      <CommandPaletteProvider>
        <QuickCreateProvider>
          <TopBarSlotProvider value={<TopBar />}>
            <Sidebar />
            <main className="min-h-dvh transition-[padding] duration-200 ease-out" style={{ paddingLeft: "var(--sidebar-w)" }}>
              <div className="mx-auto w-full max-w-[1360px] px-4 pb-44 md:px-8 md:pb-40">{children}</div>
            </main>
            <BottomBar />
            <CommandPalette />
            <QuickCreate />
          </TopBarSlotProvider>
        </QuickCreateProvider>
      </CommandPaletteProvider>
    </FocusTimerProvider>
  );
}
