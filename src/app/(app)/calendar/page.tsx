import { Suspense } from "react";
import { CalendarView } from "@/components/calendar/CalendarView";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Календарь" />
          <Skeleton className="h-[560px] rounded-card" />
        </>
      }
    >
      <CalendarView />
    </Suspense>
  );
}
