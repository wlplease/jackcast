"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const EVERY_MS = 60_000; // each check is one Neynar call, so keep it gentle

/** Checks for newer casts while the tab is visible and offers a one-tap refresh. */
export function NewCastsPill({ feed, newest }: { feed: string; newest: string | null }) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [capped, setCapped] = useState(false);
  const [pending, start] = useTransition();
  const last = useRef(0);

  useEffect(() => {
    setCount(0);
    if (!newest) return;
    const since = Date.parse(newest);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stop = false;

    const check = async () => {
      if (stop || document.visibilityState !== "visible") return;
      if (Date.now() - last.current < 20_000) return;
      last.current = Date.now();
      try {
        const res = await fetch(`/api/head?feed=${encodeURIComponent(feed)}`, { cache: "no-store" });
        if (res.ok) {
          const { timestamps, capped } = (await res.json()) as { timestamps: string[]; capped: boolean };
          const n = timestamps.filter((t) => Date.parse(t) > since).length;
          if (!stop) {
            setCount(n);
            setCapped(capped && n === timestamps.length);
          }
        }
      } catch {}
    };
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
  }, [feed, newest]);

  if (count < 1) return null;
  return (
    <div className="pill-wrap">
      <button
        className="pill"
        onClick={() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
          start(() => router.refresh());
        }}
        disabled={pending}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 19V5" />
          <path d="M5 12l7-7 7 7" />
        </svg>
        {pending ? "Loading…" : `${capped ? `${count}+` : count} new ${count === 1 ? "cast" : "casts"}`}
      </button>
    </div>
  );
}
