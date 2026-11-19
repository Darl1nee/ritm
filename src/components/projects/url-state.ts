"use client";
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Состояние страницы в URL: чтение параметров и точечная запись (null/"" — удалить параметр). */
export function useUrlParams() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const set = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      const s = next.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [router, pathname],
  );
  return { sp, set };
}
