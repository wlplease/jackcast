"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { CastView } from "@/lib/types";
import type { Page } from "@/lib/data";
import { CastCard } from "@/components/CastCard";
import { AICatchUp as AIDigestMount } from "@/components/AICatchUp";
import { groupRepeatedLinks } from "@/lib/feed-groups";
import { CaughtUpProvider, SeenLine } from "@/components/CaughtUp";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function InfiniteFeed({ initial, canWrite, viewerFid, mutes, groupLinks, live, audioEnabled, digestEnabled }: { initial: Page; canWrite: boolean; viewerFid: number; mutes: string[]; groupLinks: boolean; live?: string; audioEnabled: boolean; digestEnabled: boolean }) {
  const [casts, setCasts] = useState(initial.casts);
  const [cursor, setCursor] = useState(initial.cursor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sentinel = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const aiOpen = path === "/" && search.get("ai") === "1";
  const digestCasts = useRef(initial.casts.slice(0, 20));

  const loadMore = useCallback(async () => {
    if (!cursor || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/feed/${path === "/friends" ? "friends" : "following"}?cursor=${encodeURIComponent(cursor)}`);
      if (!response.ok) throw new Error("Couldn't load more casts. Try again.");
      let page = await response.json() as Page;
      const extra: CastView[] = [];
      let pages = 0;
      while (!page.casts.length && page.cursor && pages < 4) {
        const next = await fetch(`/api/feed/${path === "/friends" ? "friends" : "following"}?cursor=${encodeURIComponent(page.cursor)}`);
        if (!next.ok) break;
        page = await next.json() as Page;
        extra.push(...page.casts);
        pages++;
      }
      const additions = [...extra, ...page.casts];
      setCasts((previous) => {
        const hashes = new Set(previous.map((cast) => cast.hash));
        const unique = additions.filter((cast) => {
          if (hashes.has(cast.hash)) return false;
          hashes.add(cast.hash);
          return true;
        });
        return [...previous, ...unique];
      });
      setCursor(page.cursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load more casts. Try again.");
    } finally { setBusy(false); }
  }, [busy, cursor, path]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "800px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  useEffect(() => {
    if (!aiOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const params = new URLSearchParams(window.location.search);
        params.delete("ai");
        router.replace(`${path}${params.size ? `?${params}` : ""}`, { scroll: false });
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [aiOpen, path, router]);

  function closeAi() {
    const params = new URLSearchParams(search.toString());
    params.delete("ai");
    const suffix = params.size ? `?${params}` : "";
    router.replace(`${path}${suffix}`, { scroll: false });
  }

  const list = groupLinks ? groupRepeatedLinks(casts) : casts.map((cast) => [cast]);
  return <>
    {aiOpen && <div className="ai-overlay" role="dialog" aria-modal="true" aria-label="AI catch-up">
      <button className="ai-overlay-backdrop" type="button" onClick={closeAi} aria-label="Close AI catch-up" />
      <div className="ai-overlay-panel"><button className="ai-overlay-x" type="button" onClick={closeAi} aria-label="Close AI catch-up">×</button>
        <AIDigestMount casts={digestCasts.current} audioEnabled={audioEnabled} digestEnabled={digestEnabled} />
      </div>
    </div>}
    <CaughtUpProvider feed={live ?? path} newest={initial.casts[0]?.timestamp ?? null}>
    <div className="infinite-feed">
      {list.map((group, index) => <Fragment key={group[0].hash}>
        {index > 0 && <SeenLine above={list[index - 1][0].timestamp} below={group[0].timestamp} />}
        <div className="feed-group">
        <CastCard cast={group[0]} canWrite={canWrite} viewerFid={viewerFid} mutes={mutes} />
        {group.length > 1 && <details className="expandable-casts"><summary>{group.length - 1} more with this link</summary>{group.slice(1).map((cast: CastView) => <CastCard key={cast.hash} cast={cast} canWrite={canWrite} viewerFid={viewerFid} mutes={mutes} />)}</details>}
        </div>
      </Fragment>)}
      <div ref={sentinel} className="feed-load-sentinel" aria-hidden="true" />
      {cursor && <div className="feed-load-more">{error && <p className="form-error" role="status">{error}</p>}<button className="more" type="button" onClick={() => void loadMore()} disabled={busy}>{busy ? "Loading more…" : "Load more casts"}</button></div>}
      {!cursor && casts.length > 0 && <p className="feed-end">You’re all caught up.</p>}
    </div>
    </CaughtUpProvider>
  </>;
}

