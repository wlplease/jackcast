"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useLayoutEffect } from "react";

/** Keep a lightweight, per-tab reading position for each feed route. */
export function FeedScrollRestoration() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = new URLSearchParams(searchParams.toString());
  // Cursor pagination and the catch-up overlay do not represent separate feeds.
  query.delete("cursor");
  query.delete("ai");
  query.sort();
  const view = query.toString();
  const routeKey = `${pathname}${view ? `?${view}` : ""}`;

  useLayoutEffect(() => {
    const key = `selfcaster:scroll:${routeKey}`;
    try {
      const saved = Number(sessionStorage.getItem(key));
      if (Number.isFinite(saved) && saved > 0) window.scrollTo(0, saved);
    } catch {}

    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try { sessionStorage.setItem(key, String(window.scrollY)); } catch {}
      }, 120);
    };
    const saveNow = () => {
      if (timer) clearTimeout(timer);
      try { sessionStorage.setItem(key, String(window.scrollY)); } catch {}
    };
    window.addEventListener("scroll", save, { passive: true });
    window.addEventListener("pagehide", saveNow);
    return () => {
      saveNow();
      window.removeEventListener("scroll", save);
      window.removeEventListener("pagehide", saveNow);
    };
  }, [routeKey]);

  return null;
}
