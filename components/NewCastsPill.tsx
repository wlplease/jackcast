"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const EVERY_MS = 60_000; // each check is one Neynar call, so keep it gentle

/** Checks for newer casts while the tab is visible and offers a one-tap refresh. */
export function NewCastsPill({ feed, newest }: { feed: string; newest: string | null }) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [capped, setCapped] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [showTop, setShowTop] = useState(false);
  const [pending, start] = useTransition();
  const [retryAttempt, setRetryAttempt] = useState(0);
  const last = useRef(0);

  function refreshFeed() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    start(() => router.refresh());
  }

  useEffect(() => {
    const updateTopVisibility = () => setShowTop(window.scrollY > 500);
    updateTopVisibility();
    window.addEventListener("scroll", updateTopVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateTopVisibility);
  }, []);

  useEffect(() => {
    setCount(0);
    setCheckError("");
    if (!newest) return;
    const since = Date.parse(newest);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stop = false;

    const check = async (force = false) => {
      if (stop || document.visibilityState !== "visible") return;
      if (!force && Date.now() - last.current < 20_000) return;
      last.current = Date.now();
      try {
        const res = await fetch(`/api/head?feed=${encodeURIComponent(feed)}`, { cache: "no-store" });
        if (res.ok) {
          const { timestamps, capped } = (await res.json()) as { timestamps: string[]; capped: boolean };
          const n = timestamps.filter((t) => Date.parse(t) > since).length;
          if (!stop) {
            setCount(n);
            setCapped(capped && n === timestamps.length);
            setCheckError("");
          }
        } else if (!stop) {
          setCheckError(res.status === 401
            ? "Your Farcaster connection needs attention. Reconnect in You → Account."
            : "Neynar couldn't check for new casts. Your loaded feed is still available; it will retry shortly.");
        }
      } catch {
        if (!stop) setCheckError("Couldn't check for new casts. Your loaded feed is still available; it will retry shortly.");
      }
    };
    if (retryAttempt > 0) void check(true);
    const loop = () => {
      timer = setTimeout(async () => {
        await check();
        if (!stop) loop();
      }, EVERY_MS);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    loop();
    return () => {
      stop = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [feed, newest, retryAttempt]);

  return (
    <>
    {checkError && <div className="feed-poll-status" role="status">{checkError} <button type="button" onClick={() => setRetryAttempt((attempt) => attempt + 1)}>Retry check</button> <button type="button" onClick={refreshFeed} disabled={pending}>Refresh feed</button></div>}
    <div className="pill-wrap feed-quick-actions">
      {count > 0 ? <button className="pill" onClick={refreshFeed} disabled={pending}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></svg>
        {pending ? "Loading…" : `${capped ? `${count}+` : count} new ${count === 1 ? "cast" : "casts"}`}
      </button> : <button className="pill feed-refresh-button" onClick={refreshFeed} disabled={pending} aria-label="Refresh feed and return to the top">{pending ? "Refreshing…" : "↻ Refresh feed"}</button>}
      {showTop && <button className="pill feed-top-button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top">↑ Top</button>}
    </div>
    </>
  );
}
