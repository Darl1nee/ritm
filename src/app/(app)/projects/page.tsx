import { Suspense } from "react";
import { ProjectsListPage } from "@/components/projects/ProjectsListPage";

export default function ProjectsPage() {
  return (
    <Suspense>
      <ProjectsListPage />
    </Suspense>
  );
}
