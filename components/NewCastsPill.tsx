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
  const [refreshDismissed, setRefreshDismissed] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [pending, start] = useTransition();
  const [retryAttempt, setRetryAttempt] = useState(0);
  const last = useRef(0);
  const refreshStarted = useRef(false);
  const readingAnchor = useRef<{ id: string; top: number } | null>(null);

  function refreshFeed() {
    const firstVisibleCast = [...document.querySelectorAll<HTMLElement>('.cast[id^="cast-"]')]
      .find((cast) => cast.getBoundingClientRect().bottom > 0);
    readingAnchor.current = firstVisibleCast
      ? { id: firstVisibleCast.id, top: firstVisibleCast.getBoundingClientRect().top }
      : null;
    setLoadedCount(count);
    refreshStarted.current = true;
    setRefreshDismissed(false);
    start(() => router.refresh());
  }

  useEffect(() => {
    if (!pending && refreshStarted.current) {
      refreshStarted.current = false;
      const anchor = readingAnchor.current;
      if (anchor) {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const cast = document.getElementById(anchor.id);
          if (cast) window.scrollBy(0, cast.getBoundingClientRect().top - anchor.top);
        }));
      }
      setRefreshDismissed(true);
    }
  }, [pending]);

  useEffect(() => { setRefreshDismissed(false); }, [feed]);

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
            if (n > 0) setRefreshDismissed(false);
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
    {checkError && <div className="feed-poll-status" role="status">{checkError} <button type="button" onClick={() => setRetryAttempt((attempt) => attempt + 1)}>Retry check</button> {!refreshDismissed && <button type="button" onClick={refreshFeed} disabled={pending}>Refresh feed</button>}</div>}
    {(!refreshDismissed || showTop || loadedCount > 0) && <div className="pill-wrap feed-quick-actions">
      {!refreshDismissed && (count > 0 ? <button className="pill" onClick={refreshFeed} disabled={pending}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></svg>
        {pending ? "Loading…" : `${capped ? `${count}+` : count} new ${count === 1 ? "cast" : "casts"}`}
      </button> : <button className="pill feed-refresh-button" onClick={refreshFeed} disabled={pending} aria-label="Refresh feed and keep your place">{pending ? "Refreshing…" : "↻ Refresh feed"}</button>)}
      {loadedCount > 0 && <button className="pill feed-loaded-button" onClick={() => { setLoadedCount(0); window.scrollTo({ top: 0, behavior: "smooth" }); }}>New casts ready · View newest</button>}
      {showTop && <button className="pill feed-top-button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top">↑ Top</button>}
    </div>}
    </>
  );
}
