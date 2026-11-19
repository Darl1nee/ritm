import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { TasksView } from "@/components/tasks/TasksView";

export default function TasksPage() {
  return (
    <Suspense fallback={<PageHeader title="Задачи" />}>
      <TasksView />
    </Suspense>
  );
}
