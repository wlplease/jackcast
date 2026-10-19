"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function NotificationLink({ icon }: { icon: React.ReactNode }) {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const lastFetch = useRef(0);
  const clearedAt = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    const refresh = async (force = false) => {
      if (!force && Date.now() - lastFetch.current < 180_000) return;
      lastFetch.current = Date.now();
      try {
        const response = await fetch("/api/notifications/count", { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json() as { count?: number; newestUnseenAt?: string | null };
        if (active && typeof result.count === "number") {
          const newestUnseenAt = result.newestUnseenAt ? Date.parse(result.newestUnseenAt) : Number.NaN;
          // Ignore stale pre-clear counts, but allow any notification created after the clear.
          if (clearedAt.current && result.count > 0 && (!Number.isFinite(newestUnseenAt) || newestUnseenAt <= clearedAt.current)) return;
          if (result.count === 0 || newestUnseenAt > clearedAt.current) clearedAt.current = 0;
          const nextCount = Math.max(0, result.count);
          setCount(nextCount);
          window.dispatchEvent(new CustomEvent("jackcaster:notifications-count", { detail: { count: nextCount, newestUnseenAt: result.newestUnseenAt ?? null } }));
        }
      } catch {}
    };

    try {
      const marker = Number(localStorage.getItem("jackcaster:notifications-cleared"));
      if (Number.isFinite(marker) && marker > 0) clearedAt.current = marker;
    } catch {}
    if (pathname === "/notifications") {
      timer = setTimeout(() => { void refresh(true); }, 2000);
    } else {
      void refresh();
    }
    const interval = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 300_000);
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    const applyRead = (timestamp: number) => {
      clearedAt.current = timestamp;
      setCount(0);
    };
    const read = (event: Event) => {
      const timestamp = Number((event as CustomEvent<number>).detail);
      applyRead(Number.isFinite(timestamp) ? timestamp : Date.now());
    };
    const manualRefresh = () => { void refresh(true); };
    const storage = (event: StorageEvent) => {
      if (event.key === "jackcaster:notifications-cleared" && event.newValue) {
        const timestamp = Number(event.newValue);
        if (Number.isFinite(timestamp)) applyRead(timestamp);
      }
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("jackcaster:notifications-read", read);
    window.addEventListener("jackcaster:notifications-refresh", manualRefresh);
    window.addEventListener("storage", storage);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("jackcaster:notifications-read", read);
      window.removeEventListener("jackcaster:notifications-refresh", manualRefresh);
      window.removeEventListener("storage", storage);
    };
  }, [pathname]);

  return (
    <Link href="/notifications" className="icon-btn" aria-label={count ? `Notifications, ${count} new` : "Notifications"} aria-current={pathname.startsWith("/notifications") ? "page" : undefined} title="Notifications">
      {icon}
      {count > 0 && <span className="badge">{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}
