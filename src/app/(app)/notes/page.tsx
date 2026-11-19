import { Suspense } from "react";
import { NotesPage } from "@/components/notes/NotesPage";

export default function Page() {
  return (
    <Suspense>
      <NotesPage />
    </Suspense>
  );
}
