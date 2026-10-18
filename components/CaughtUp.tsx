"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * "Where you left off" for a chronological feed.
 * Remembers the newest cast you've seen (per feed, on this device) and draws a line
 * between what's new and what you've already read.
 */

const Ctx = createContext<number | null>(null);

function read(key: string): number | null {
  try {
    const v = localStorage.getItem(key);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function write(key: string, ts: number) {
  try {
    const prev = read(key);
    if (!prev || ts > prev) localStorage.setItem(key, String(ts));
  } catch {}
}

export function CaughtUpProvider({
  feed,
  newest,
  children,
}: {
  feed: string;
  newest: string | null;
  children: React.ReactNode;
}) {
  const key = `selfcaster:seen:${feed}`;
  // Snapshot what you'd seen *before* this visit. Read after mount to avoid SSR mismatch.
  const [lastSeen, setLastSeen] = useState<number | null>(null);

  useEffect(() => {
    setLastSeen(read(key));
    if (!newest) return;
    const ts = Date.parse(newest);
    // Mark this visit as seen when you leave, so the line stays put while you read.
    const save = () => write(key, ts);
    const onHide = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);
    return () => {
      save();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
    };
  }, [key, newest]);

  const nothingNew = lastSeen !== null && newest !== null && Date.parse(newest) <= lastSeen;

  return (
    <Ctx.Provider value={lastSeen}>
      {nothingNew && (
        <div className="seen-top" role="status">
          Nothing new since you were last here.
        </div>
      )}
      {children}
    </Ctx.Provider>
  );
}

/** Rendered between two casts. Shows only at the boundary between new and already-seen. */
export function SeenLine({ above, below }: { above: string; below: string }) {
  const lastSeen = useContext(Ctx);
  if (lastSeen === null) return null;
  const a = Date.parse(above);
  const b = Date.parse(below);
  if (!(b <= lastSeen && lastSeen < a)) return null;
  return (
    <div className="seen-line" role="separator" aria-label="You're caught up">
      <span>You&apos;re caught up</span>
    </div>
  );
}
