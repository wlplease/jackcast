"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function NotificationLink({ icon }: { icon: React.ReactNode }) {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const lastFetch = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    const refresh = async (force = false) => {
      if (!force && Date.now() - lastFetch.current < 180_000) return;
      lastFetch.current = Date.now();
      try {
        const response = await fetch("/api/notifications/count", { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json() as { count?: number };
        if (active && typeof result.count === "number") setCount(Math.max(0, result.count));
      } catch {}
    };

    if (pathname === "/notifications") {
      timer = setTimeout(() => { void refresh(true); }, 2000);
    } else {
      void refresh();
    }
    const interval = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 300_000);
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    const read = () => setCount(0);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("jackcaster:notifications-read", read);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("jackcaster:notifications-read", read);
    };
  }, [pathname]);

  return (
    <Link href="/notifications" className="icon-btn" aria-label={count ? `Notifications, ${count} new` : "Notifications"} aria-current={pathname.startsWith("/notifications") ? "page" : undefined} title="Notifications">
      {icon}
      {count > 0 && <span className="badge">{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}
