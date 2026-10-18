"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { savePrefs } from "@/app/(main)/me/actions";
import type { Prefs } from "@/lib/prefs-shared";

export function ActiveFeedFilters({ prefs }: { prefs: Prefs }) {
  const active = [
    prefs.mutes.length > 0 && `${prefs.mutes.length} muted ${prefs.mutes.length === 1 ? "term" : "terms"}`,
    prefs.quality !== null && "Custom quality",
    !prefs.showReplies && "Replies hidden",
    prefs.hideMiniApps && "Mini apps hidden",
    !prefs.groupLinks && "Link grouping off",
  ].filter((item): item is string => Boolean(item));
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");

  if (!active.length) return null;

  function clear() {
    setMessage("");
    start(async () => {
      const result = await savePrefs({ mutes: [], quality: null, showReplies: true, hideMiniApps: false, groupLinks: true });
      setMessage(result.ok ? "Filters cleared" : result.error);
    });
  }

  return (
    <aside className="active-filters" aria-label="Active feed filters">
      <div className="active-filters-copy">
        <strong>Feed filters</strong>
        <span>{active.join(" · ")}</span>
      </div>
      <Link href="/me#filters">Edit</Link>
      <button type="button" onClick={clear} disabled={pending}>
        {pending ? "Clearing…" : "Clear"}
      </button>
      <span className="sr-only" aria-live="polite">{message}</span>
    </aside>
  );
}
