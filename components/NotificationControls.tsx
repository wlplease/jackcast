"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead } from "@/app/(main)/notifications/actions";

export function NotificationControls({ count, newestUnseenAt, canMarkRead }: { count: number; newestUnseenAt?: string | null; canMarkRead: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(count);
  const clearedAt = useRef(0);
  useEffect(() => {
    try {
      const marker = Number(localStorage.getItem("jackcaster:notifications-cleared"));
      if (!Number.isFinite(marker) || marker <= 0) return;
      clearedAt.current = marker;
      document.querySelectorAll<HTMLElement>(".note.unseen[data-notification-time]").forEach((item) => {
        const timestamp = Date.parse(item.dataset.notificationTime ?? "");
        if (Number.isFinite(timestamp) && timestamp <= marker) item.classList.remove("unseen");
      });
      const newest = newestUnseenAt ? Date.parse(newestUnseenAt) : Number.NaN;
      if (count > 0 && (!Number.isFinite(newest) || newest <= marker)) setVisibleCount(0);
      else if (newest > marker) clearedAt.current = 0;
    } catch {}
  }, [count, newestUnseenAt]);
  useEffect(() => {
    const newest = newestUnseenAt ? Date.parse(newestUnseenAt) : Number.NaN;
    if (clearedAt.current && count > 0 && (!Number.isFinite(newest) || newest <= clearedAt.current)) return;
    if (count === 0 || newest > clearedAt.current) clearedAt.current = 0;
    setVisibleCount(Math.max(0, count));
  }, [count, newestUnseenAt]);
  useEffect(() => {
    const onRead = (event: Event) => {
      const timestamp = Number((event as CustomEvent<number>).detail);
      clearedAt.current = Number.isFinite(timestamp) ? timestamp : Date.now();
      setVisibleCount(0);
      document.querySelectorAll(".note.unseen").forEach((item) => item.classList.remove("unseen"));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "jackcaster:notifications-cleared" || !event.newValue) return;
      const timestamp = Number(event.newValue);
      if (Number.isFinite(timestamp)) window.dispatchEvent(new CustomEvent("jackcaster:notifications-read", { detail: timestamp }));
    };
    window.addEventListener("jackcaster:notifications-read", onRead);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("jackcaster:notifications-read", onRead);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  useEffect(() => {
    const onCount = (event: Event) => {
      const detail = (event as CustomEvent<{ count?: number; newestUnseenAt?: string | null }>).detail;
      const next = detail?.count;
      const newest = detail?.newestUnseenAt ? Date.parse(detail.newestUnseenAt) : Number.NaN;
      if (!Number.isSafeInteger(next) || (next as number) < 0 || (clearedAt.current && (next as number) > 0 && (!Number.isFinite(newest) || newest <= clearedAt.current))) return;
      if ((next as number) === 0 || newest > clearedAt.current) clearedAt.current = 0;
      setVisibleCount(next as number);
    };
    window.addEventListener("jackcaster:notifications-count", onCount);
    return () => window.removeEventListener("jackcaster:notifications-count", onCount);
  }, []);
  return <div className="notification-controls">
    <span className="meta" aria-live="polite">{visibleCount > 0 ? `${visibleCount} unread` : "All caught up"}</span>
    <button type="button" className="linkish" onClick={() => { window.dispatchEvent(new Event("jackcaster:notifications-refresh")); router.refresh(); }} disabled={pending}>{pending ? "Refreshing…" : "Refresh"}</button>
    {visibleCount > 0 && canMarkRead && <button type="button" className="btn ghost sm" disabled={pending} onClick={() => start(async () => {
      setError("");
      const result = await markAllNotificationsRead();
      if (!result.ok) { setError(result.error); return; }
      clearedAt.current = Date.parse(result.clearedAt);
      setVisibleCount(0);
      try { localStorage.setItem("jackcaster:notifications-cleared", String(clearedAt.current)); } catch {}
      window.dispatchEvent(new CustomEvent("jackcaster:notifications-read", { detail: clearedAt.current }));
      router.refresh();
    })}>{pending ? "Marking read…" : "Mark all read"}</button>}
    {error && <span className="form-error" role="status">{error}</span>}
  </div>;
}
