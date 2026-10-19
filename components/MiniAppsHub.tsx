"use client";

import { useEffect, useState } from "react";
import { loadMiniAppSearch, refreshMiniApps } from "@/app/(main)/mini-apps/actions";
import type { MiniAppSummary } from "@/lib/data";
import { MiniAppSaveButton } from "@/components/MiniAppSaveButton";
import { MiniAppLaunchButton } from "@/components/MiniAppLaunchButton";
import { MiniAppIcon } from "@/components/MiniAppIcon";
import type { Prefs } from "@/lib/prefs-shared";

const RECENT_KEY = "jackcaster:recent-mini-apps:v1";
type RecentApp = { url: string; title: string };

function AppGrid({ apps, saved, onSaved, onLaunch }: { apps: MiniAppSummary[]; saved: Prefs["savedMiniApps"]; onSaved: (items: Prefs["savedMiniApps"]) => void; onLaunch: (app: RecentApp) => void }) {
  if (!apps.length) return <p className="field-hint">No mini apps found in this section yet.</p>;
  return <div className="miniapp-grid">{apps.map((app) => <article key={app.url} className="miniapp-card">
    <MiniAppIcon src={app.image} />
    <span className="miniapp-card-copy"><b>{app.title}</b>{app.author && <small>by {app.author}</small>}{app.description && <span>{app.description}</span>}</span>
    <span className="miniapp-actions"><MiniAppSaveButton app={{ url: app.url, title: app.title }} saved={saved.some((item) => item.url === app.url)} allSaved={saved} onSaved={onSaved} /><MiniAppLaunchButton app={{ url: app.url, title: app.title }} onLaunch={onLaunch} /></span>
  </article>)}</div>;
}

export function MiniAppsHub({ weekly, relevant, generatedAt, initialSaved, feedTitle = "Mini Apps" }: { weekly: MiniAppSummary[]; relevant: MiniAppSummary[]; generatedAt: number; initialSaved: Prefs["savedMiniApps"]; feedTitle?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MiniAppSummary[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [error, setError] = useState("");
  const [savedApps, setSavedApps] = useState(initialSaved);
  const [category, setCategory] = useState("all");
  const [recentApps, setRecentApps] = useState<RecentApp[]>([]);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") as unknown;
      if (Array.isArray(raw)) setRecentApps(raw.filter((entry): entry is RecentApp => {
        if (!entry || typeof entry !== "object" || typeof (entry as RecentApp).url !== "string" || typeof (entry as RecentApp).title !== "string") return false;
        try { const url = new URL((entry as RecentApp).url); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
      }).slice(0, 8));
    } catch { setRecentApps([]); }
  }, []);

  function rememberApp(app: RecentApp) {
    setRecentApps((current) => {
      const next = [app, ...current.filter((item) => item.url !== app.url)].slice(0, 8);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setError("");
    try {
      const result = await loadMiniAppSearch(query);
      if (!result.ok) { setError(result.error); setResults(null); }
      else setResults(result.apps);
    } catch {
      setError("Mini app search is unavailable right now. Try again shortly.");
      setResults(null);
    } finally { setSearching(false); }
  }

  const categories = ["all", ...Array.from(new Set(weekly.map((app) => app.category).filter((value): value is string => Boolean(value))))];
  const visibleWeekly = category === "all" ? weekly : weekly.filter((app) => app.category === category);

  return <>
    <section className="section-head miniapps-heading"><div><h1>{feedTitle}</h1><p>Discover what people are building and using on Farcaster.</p></div><div className="miniapps-updated"><span className="meta">Updated {new Date(generatedAt).toLocaleDateString()}</span><button className="linkish" disabled={refreshing} onClick={async () => { setRefreshing(true); setRefreshError(""); try { await refreshMiniApps(); window.location.reload(); } catch { setRefreshError("Could not refresh the Mini App catalog. Your current list is still available; try again shortly."); } finally { setRefreshing(false); } }}>{refreshing ? "Refreshing…" : "Refresh"}</button></div></section>
    {refreshError && <p className="form-error miniapp-error" role="status">{refreshError}</p>}
    <form className="miniapp-search" role="search" onSubmit={search}>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search mini apps" aria-label="Search mini apps" maxLength={80} />
      <button className="btn ghost sm" disabled={searching || query.trim().length < 2}>{searching ? "Searching…" : "Search"}</button>
    </form>
    {error && <p className="form-error miniapp-error" role="status">{error}</p>}
    {recentApps.length > 0 && <section className="me-section"><div className="me-section-head"><h2>Recently opened</h2><button type="button" className="linkish" onClick={() => { setRecentApps([]); try { localStorage.removeItem(RECENT_KEY); } catch {} }}>Clear</button></div><AppGrid apps={recentApps.map((app) => ({ ...app }))} saved={savedApps} onSaved={setSavedApps} onLaunch={rememberApp} /></section>}
    {savedApps.length > 0 && <section className="me-section"><div className="me-section-head"><h2>Favorites</h2><span className="meta">this device · {savedApps.length}/6</span></div><AppGrid apps={savedApps.map((app) => ({ ...app }))} saved={savedApps} onSaved={setSavedApps} onLaunch={rememberApp} /></section>}
    {results && <section className="me-section"><div className="me-section-head"><h2>Search results</h2><button className="linkish" onClick={() => { setResults(null); setQuery(""); }}>Clear</button></div><AppGrid apps={results} saved={savedApps} onSaved={setSavedApps} onLaunch={rememberApp} /></section>}
    <section className="me-section"><div className="me-section-head"><h2>Trending this week</h2><span className="meta">Neynar 7-day trend</span></div><p className="field-hint">Ranked by Neynar’s mini app trending score for the last 7 days.</p><div className="miniapp-categories" aria-label="Filter mini apps by category">{categories.map((value) => <button key={value} className={category === value ? "active" : ""} onClick={() => setCategory(value)}>{value === "all" ? "All" : value}</button>)}</div><AppGrid apps={visibleWeekly} saved={savedApps} onSaved={setSavedApps} onLaunch={rememberApp} /></section>
    <section className="me-section"><div className="me-section-head"><h2>For your network</h2><span className="meta">Personalized · 7 days</span></div><p className="field-hint">Based on mini apps shared by people Neynar identifies as relevant to you.</p><AppGrid apps={relevant} saved={savedApps} onSaved={setSavedApps} onLaunch={rememberApp} /></section>
  </>;
}
