"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { CastView } from "@/lib/types";
import type { Page } from "@/lib/data";
import { CastCard } from "@/components/CastCard";
import { AICatchUp as AIDigestMount } from "@/components/AICatchUp";
import { groupRepeatedLinks } from "@/lib/feed-groups";
import { CaughtUpProvider, SeenLine } from "@/components/CaughtUp";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function InfiniteFeed({ initial, canWrite, viewerFid, mutes, groupLinks, live, mediaKind = "all", audioEnabled, digestEnabled, emptyTitle = "Your feed is empty", emptyBody = "Load more casts or check back later." }: { initial: Page; canWrite: boolean; viewerFid: number; mutes: string[]; groupLinks: boolean; live?: string; mediaKind?: string; audioEnabled: boolean; digestEnabled: boolean; emptyTitle?: string; emptyBody?: string }) {
  const [casts, setCasts] = useState(initial.casts);
  const [cursor, setCursor] = useState(initial.cursor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [autoLoadPaused, setAutoLoadPaused] = useState(false);
  const [earlierOpen, setEarlierOpen] = useState(false);
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestLoadError, setDigestLoadError] = useState("");
  const [digestLoadMore, setDigestLoadMore] = useState(false);
  const [digestLoadAttempt, setDigestLoadAttempt] = useState(0);
  const [sentKind, setSentKind] = useState<"all" | "casts" | "replies">("all");
  const [sentRange, setSentRange] = useState<"all" | "7d" | "30d">("all");
  const castsRef = useRef(casts);
  const initialCastsRef = useRef(initial.casts);
  const cursorRef = useRef(cursor);
  const requestInFlight = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const aiDialog = useRef<HTMLDivElement>(null);
  const aiClose = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const path = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const aiOpen = path === "/" && search.get("ai") === "1";

  castsRef.current = casts;
  cursorRef.current = cursor;

  useEffect(() => {
    if (initialCastsRef.current === initial.casts) return;
    initialCastsRef.current = initial.casts;
    const refreshedByHash = new Map(initial.casts.map((cast) => [cast.hash, cast]));
    setCasts((current) => {
      const currentHashes = new Set(current.map((cast) => cast.hash));
      const additions = initial.casts.filter((cast) => !currentHashes.has(cast.hash));
      const next = [...additions, ...current.map((cast) => refreshedByHash.get(cast.hash) ?? cast)];
      castsRef.current = next;
      return next;
    });
  }, [initial.casts]);

  const appendCasts = useCallback((additions: CastView[]) => {
    const hashes = new Set(castsRef.current.map((cast) => cast.hash));
    const unique = additions.filter((cast) => {
      if (hashes.has(cast.hash)) return false;
      hashes.add(cast.hash);
      return true;
    });
    const next = [...castsRef.current, ...unique];
    castsRef.current = next;
    setCasts(next);
  }, []);

  useEffect(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const currentCasts = castsRef.current;
    let loadedRecent = currentCasts.filter((cast) => Date.parse(cast.timestamp) >= cutoff).length;
    if (!aiOpen || busy || !cursorRef.current || loadedRecent >= 40 || currentCasts.some((cast) => Date.parse(cast.timestamp) < cutoff) || requestInFlight.current) return;
    let cancelled = false;
    async function loadRecentPosts() {
      setDigestLoading(true);
      setDigestLoadError("");
      setDigestLoadMore(false);
      let pages = 0;
      try {
        while (cursorRef.current && pages < 4 && loadedRecent < 40 && !cancelled) {
          requestInFlight.current = true;
          const nextCursor = cursorRef.current;
          const response = await fetch(`/api/feed/following?cursor=${encodeURIComponent(nextCursor)}`);
          if (!response.ok) throw new Error("Couldn’t load recent Following posts. Try again.");
          const page = await response.json() as Page;
          if (cancelled) break;
          const existing = new Set(castsRef.current.map((cast) => cast.hash));
          const additions = page.casts.filter((cast) => !existing.has(cast.hash));
          loadedRecent += additions.filter((cast) => Date.parse(cast.timestamp) >= cutoff).length;
          appendCasts(additions);
          cursorRef.current = page.cursor;
          setCursor(page.cursor);
          pages++;
          const oldest = page.casts.reduce((value, cast) => Math.min(value, Date.parse(cast.timestamp) || Infinity), Infinity);
          if (oldest < cutoff || loadedRecent >= 40) break;
        }
        if (!cancelled && cursorRef.current && pages >= 4 && loadedRecent < 40 && !castsRef.current.some((cast) => Date.parse(cast.timestamp) < cutoff)) setDigestLoadMore(true);
      } catch (error) {
        if (!cancelled) setDigestLoadError(error instanceof Error ? error.message : "Couldn’t load recent Following posts. Try again.");
      } finally {
        requestInFlight.current = false;
        if (!cancelled) setDigestLoading(false);
      }
    }
    void loadRecentPosts();
    return () => { cancelled = true; };
  }, [aiOpen, busy, digestLoadAttempt, appendCasts]);

  const loadMore = useCallback(async (manualRetry = false) => {
    if (!cursor || busy || requestInFlight.current) return;
    if (manualRetry) setAutoLoadPaused(false);
    requestInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const feed = path === "/friends" ? "friends" : path === "/media" ? "media" : path === "/top" ? "top" : path === "/sent" ? "jackcast" : "following";
      const mediaQuery = feed === "media" ? `&type=${encodeURIComponent(mediaKind)}` : "";
      const response = await fetch(`/api/feed/${feed}?cursor=${encodeURIComponent(cursor)}${mediaQuery}`);
      if (!response.ok) throw new Error("Couldn't load more casts. Try again.");
      let page = await response.json() as Page;
      const extra: CastView[] = [];
      let pages = 0;
      const seenCursors = new Set([cursor]);
      while (!page.casts.length && page.cursor && pages < 4) {
        if (seenCursors.has(page.cursor)) throw new Error("The feed returned the same page twice. Refresh and try again.");
        seenCursors.add(page.cursor);
        const next = await fetch(`/api/feed/${feed}?cursor=${encodeURIComponent(page.cursor)}${mediaQuery}`);
        if (!next.ok) throw new Error("Couldn't load more casts. Try again.");
        page = await next.json() as Page;
        extra.push(...page.casts);
        pages++;
      }
      const additions = [...extra, ...page.casts];
      appendCasts(additions);
      cursorRef.current = page.cursor;
      setCursor(page.cursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load more casts. Try again.");
      setAutoLoadPaused(true);
    } finally { requestInFlight.current = false; setBusy(false); }
  }, [appendCasts, busy, cursor, mediaKind, path]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor || autoLoadPaused) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "800px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [autoLoadPaused, cursor, loadMore]);

  useEffect(() => {
    if (!aiOpen) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => aiClose.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const params = new URLSearchParams(window.location.search);
        params.delete("ai");
        router.replace(`${path}${params.size ? `?${params}` : ""}`, { scroll: false });
      }
      if (event.key === "Tab" && aiDialog.current) {
        const focusable = [...aiDialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((item) => item.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus();
    };
  }, [aiOpen, path, router]);

  function closeAi() {
    const params = new URLSearchParams(search.toString());
    params.delete("ai");
    const suffix = params.size ? `?${params}` : "";
    router.replace(`${path}${suffix}`, { scroll: false });
  }

  const sentCutoff = sentRange === "all" ? 0 : Date.now() - (sentRange === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000;
  const visibleCasts = path === "/sent" ? casts.filter((cast) => (sentKind === "all" || (sentKind === "replies" ? Boolean(cast.parent_hash) : !cast.parent_hash)) && (sentCutoff === 0 || Date.parse(cast.timestamp) >= sentCutoff)) : casts;
  const activeCount = visibleCasts.length > 180 ? 120 : visibleCasts.length;
  const activeCasts = visibleCasts.slice(0, activeCount);
  const earlierCasts = visibleCasts.slice(activeCount);
  const list = groupLinks ? groupRepeatedLinks(activeCasts) : activeCasts.map((cast) => [cast]);
  const earlierList = earlierOpen ? (groupLinks ? groupRepeatedLinks(earlierCasts) : earlierCasts.map((cast) => [cast])) : [];
  return <>
    {aiOpen && <div className="ai-overlay" role="dialog" aria-modal="true" aria-label="AI catch-up">
      <button className="ai-overlay-backdrop" type="button" onClick={closeAi} aria-label="Close AI catch-up" />
      <div className="ai-overlay-panel" ref={aiDialog}><button ref={aiClose} className="ai-overlay-x" type="button" onClick={closeAi} aria-label="Close AI catch-up">×</button>
        {digestLoading && <p className="field-hint" role="status">Loading recent Following posts for the seven-day catch-up…</p>}
        {digestLoadError && <p className="form-error" role="alert">{digestLoadError} <button type="button" onClick={() => setDigestLoadAttempt((attempt) => attempt + 1)}>Retry</button></p>}
        {digestLoadMore && !digestLoading && <p className="field-hint">The seven-day scan reached its page limit before confirming the full date range. The digest uses the recent posts loaded so far. <button type="button" onClick={() => setDigestLoadAttempt((attempt) => attempt + 1)}>Load more recent posts</button></p>}
        <AIDigestMount casts={casts.slice(0, 40)} viewerFid={viewerFid} audioEnabled={audioEnabled} digestEnabled={digestEnabled} />
      </div>
    </div>}
    <CaughtUpProvider feed={live ?? path} newest={initial.casts[0]?.timestamp ?? null}>
    <div className="infinite-feed">
      {path === "/sent" && <div className="sent-feed-filters" aria-label="Filter sent casts">
        <label>Show <select value={sentKind} onChange={(event) => setSentKind(event.target.value as typeof sentKind)}><option value="all">Posts and replies</option><option value="casts">Posts only</option><option value="replies">Replies only</option></select></label>
        <label>When <select value={sentRange} onChange={(event) => setSentRange(event.target.value as typeof sentRange)}><option value="all">Any time</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select></label>
        <span className="meta">{visibleCasts.length} shown from {casts.length} loaded</span>
      </div>}
      {casts.length === 0 && cursor && <p className="field-hint" role="status">Looking through recent posts…</p>}
      {casts.length === 0 && !cursor && <div className="empty"><h2>{emptyTitle}</h2><p>{emptyBody}</p></div>}
      {casts.length > 0 && visibleCasts.length === 0 && <div className="empty"><h2>No matches in the loaded posts</h2><p>Load more posts or change these filters.</p></div>}
      {earlierCasts.length > 0 && <details className="feed-archive" onToggle={(event) => setEarlierOpen(event.currentTarget.open)}><summary>{earlierOpen ? "Hide" : "Show"} {earlierCasts.length} earlier loaded casts</summary>{earlierOpen && <div>{earlierList.map((group) => <div className="feed-group" key={group[0].hash}><CastCard cast={group[0]} canWrite={canWrite} viewerFid={viewerFid} mutes={mutes} />{group.length > 1 && <details className="expandable-casts"><summary>{group.length - 1} more with this link</summary>{group.slice(1).map((cast) => <CastCard key={cast.hash} cast={cast} canWrite={canWrite} viewerFid={viewerFid} mutes={mutes} />)}</details>}</div>)}</div>}</details>}
      {earlierCasts.length > 0 && activeCasts.length > 0 && <SeenLine above={activeCasts[0].timestamp} below={earlierCasts[earlierCasts.length - 1].timestamp} />}
      {list.map((group, index) => <Fragment key={group[0].hash}>
        {index > 0 && <SeenLine above={list[index - 1][0].timestamp} below={group[0].timestamp} />}
        <div className="feed-group">
        <CastCard cast={group[0]} canWrite={canWrite} viewerFid={viewerFid} mutes={mutes} />
        {group.length > 1 && <details className="expandable-casts"><summary>{group.length - 1} more with this link</summary>{group.slice(1).map((cast: CastView) => <CastCard key={cast.hash} cast={cast} canWrite={canWrite} viewerFid={viewerFid} mutes={mutes} />)}</details>}
        </div>
      </Fragment>)}
      <div ref={sentinel} className="feed-load-sentinel" aria-hidden="true" />
      {cursor && <div className="feed-load-more">
        {busy && <p className="feed-load-status" role="status"><span aria-hidden="true" />Loading more casts…</p>}
        {error && <p className="feed-load-error" role="alert">{error}</p>}
        <button className="more" type="button" onClick={() => void loadMore(true)} disabled={busy}>{busy ? "Loading…" : error ? "Retry loading casts" : "Load more casts"}</button>
      </div>}
      {!cursor && visibleCasts.length > 0 && <p className="feed-end">You’re all caught up.</p>}
    </div>
    </CaughtUpProvider>
  </>;
}

