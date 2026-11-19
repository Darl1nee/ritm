import { Suspense } from "react";
import { ProjectView } from "@/components/projects/ProjectView";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <ProjectView id={id} />
    </Suspense>
  );
}
