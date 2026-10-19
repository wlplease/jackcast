"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead } from "@/app/(main)/notifications/actions";

export function NotificationControls({ count, canMarkRead }: { count: number; canMarkRead: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return <div className="notification-controls">
    <button type="button" className="linkish" onClick={() => router.refresh()} disabled={pending}>{pending ? "Refreshing…" : "Refresh"}</button>
    {count > 0 && canMarkRead && <button type="button" className="btn ghost sm" disabled={pending} onClick={() => start(async () => {
      setError("");
      const result = await markAllNotificationsRead();
      if (!result.ok) { setError(result.error); return; }
      window.dispatchEvent(new Event("jackcaster:notifications-read"));
      router.refresh();
    })}>{pending ? "Marking read…" : "Mark all read"}</button>}
    {error && <span className="form-error" role="status">{error}</span>}
  </div>;
}
