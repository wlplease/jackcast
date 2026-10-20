"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CastView } from "@/lib/types";
import { trackUsage } from "@/components/UsageAnalytics";
import { withoutCastAttribution } from "@/lib/cast-attribution";

type DigestPart = { title: string; summary: string; castHashes: string[] };
type Digest = { storyline: string; sections: DigestPart[]; insights: DigestPart[] };
type Scope = "week" | "loaded";
type DigestSource = { hash: string; fid: number; username: string; name: string; text: string; timestamp: string; likes: number; recasts: number; replies: number };
type StoredDigest = { version: 1; scope: Scope; digest: Digest; hashes: string[]; sources: DigestSource[]; savedAt: number };

function isDigest(value: unknown): value is Digest {
  if (!value || typeof value !== "object") return false;
  const digest = value as Partial<Digest>;
  const validParts = (parts: unknown) => Array.isArray(parts) && parts.every((part) => part && typeof part.title === "string" && typeof part.summary === "string" && Array.isArray(part.castHashes) && part.castHashes.every((hash: unknown) => typeof hash === "string"));
  return typeof digest.storyline === "string" && validParts(digest.sections) && validParts(digest.insights);
}

function isDigestSource(value: unknown): value is DigestSource {
  if (!value || typeof value !== "object") return false;
  const source = value as Partial<DigestSource>;
  return typeof source.hash === "string" && Number.isSafeInteger(source.fid) && typeof source.username === "string" && typeof source.name === "string" && typeof source.text === "string" && typeof source.timestamp === "string" && Number.isFinite(source.likes) && Number.isFinite(source.recasts) && Number.isFinite(source.replies);
}

function digestSource(cast: CastView): DigestSource {
  return { hash: cast.hash, fid: cast.author.fid, username: cast.author.username || "", name: authorName(cast), text: cast.text || "", timestamp: cast.timestamp, likes: cast.reactions?.likes_count || 0, recasts: cast.reactions?.recasts_count || 0, replies: cast.replies?.count || 0 };
}

function providerError(error: unknown, service: "Gemini" | "ElevenLabs"): string {
  if (!(error instanceof Error)) return `${service} is temporarily unavailable. Try again later.`;
  if (/Failed to fetch|NetworkError|Load failed|Unexpected token|JSON Parse/i.test(error.message)) {
    return `Couldn't reach ${service}. Check service availability and try again later.`;
  }
  return error.message || `${service} is temporarily unavailable. Try again later.`;
}

function authorName(cast: Pick<CastView, "author">): string {
  return cast.author.display_name || cast.author.username || `FID ${cast.author.fid}`;
}

function shortDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function AICatchUp({ casts, viewerFid, audioEnabled = false, digestEnabled = false }: { casts: CastView[]; viewerFid: number; audioEnabled?: boolean; digestEnabled?: boolean }) {
  const [scope, setScope] = useState<Scope>("week");
  const [digest, setDigest] = useState<Digest | null>(null);
  const [digestHashes, setDigestHashes] = useState<string[]>([]);
  const [digestSources, setDigestSources] = useState<DigestSource[]>([]);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioRequested, setAudioRequested] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [now] = useState(() => Date.now());
  const storageKey = `jackcaster:ai-digest:v1:${viewerFid}`;
  const weekCutoff = now - 7 * 24 * 60 * 60 * 1000;
  const weekStartDate = new Date(now);
  weekStartDate.setHours(0, 0, 0, 0);
  weekStartDate.setDate(weekStartDate.getDate() - 6);
  const weekStart = weekStartDate.getTime();
  const eligibleCasts = useMemo(() => {
    const sorted = [...casts].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    return (scope === "week" ? sorted.filter((cast) => {
      const time = Date.parse(cast.timestamp);
      return Number.isFinite(time) && time >= weekCutoff && time <= now;
    }) : sorted).slice(0, 40);
  }, [casts, scope, weekCutoff, now]);
  const digestViewSources = digest ? digestSources : [];
  const sourceByHash = useMemo(() => new Map(digestViewSources.map((cast) => [cast.hash.toLowerCase(), cast])), [digestViewSources]);
  const analytics = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);
      return { key: localDateKey(date), label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date), count: 0 };
    });
    const dayMap = new Map(days.map((day) => [day.key, day]));
    const people = new Map<number, { name: string; username: string; posts: number; engagement: number }>();
    let likes = 0, recasts = 0, replies = 0;
    for (const cast of digestViewSources) {
      const date = new Date(cast.timestamp);
      if (!Number.isNaN(date.getTime())) {
        const day = dayMap.get(localDateKey(date));
        if (day) day.count++;
      }
      likes += cast.likes;
      recasts += cast.recasts;
      replies += cast.replies;
      const fid = cast.fid;
      const row = people.get(fid) ?? { name: cast.name, username: cast.username, posts: 0, engagement: 0 };
      row.posts++;
      row.engagement += cast.likes + cast.recasts + cast.replies;
      people.set(fid, row);
    }
    const topPosts = [...digestViewSources].sort((a, b) => {
      const score = (cast: DigestSource) => cast.likes + 2 * cast.recasts + cast.replies;
      return score(b) - score(a);
    }).slice(0, 3);
    return { days, people: [...people.values()].sort((a, b) => b.posts - a.posts || b.engagement - a.engagement).slice(0, 5), likes, recasts, replies, topPosts };
  }, [digestViewSources, weekStart]);

  useEffect(() => {
    setScope("week");
    setDigest(null);
    setDigestHashes([]);
    setDigestSources([]);
    setSavedAt(0);
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "null") as StoredDigest | null;
      if (!stored || stored.version !== 1 || !isDigest(stored.digest) || !Array.isArray(stored.sources) || !Array.isArray(stored.hashes) || !stored.hashes.every((hash) => typeof hash === "string")) return;
      setScope(stored.scope === "loaded" ? "loaded" : "week");
      setDigest(stored.digest);
      setDigestHashes(stored.hashes);
      setDigestSources(stored.sources.filter(isDigestSource).slice(0, 40));
      setSavedAt(Number.isFinite(stored.savedAt) ? stored.savedAt : 0);
    } catch { /* Ignore a malformed or unavailable local cache. */ }
  }, [storageKey]);

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  async function summarize() {
    trackUsage({ name: "digest_requested", posts: eligibleCasts.length });
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/catch-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ casts: eligibleCasts.map((cast) => ({
          hash: cast.hash,
          fid: cast.author.fid,
          username: cast.author.username || "",
          author: authorName(cast),
          text: cast.text,
          timestamp: cast.timestamp,
          likes: cast.reactions?.likes_count || 0,
          recasts: cast.reactions?.recasts_count || 0,
          replies: cast.replies?.count || 0,
        })) }),
      });
      const data = await response.json() as { digest?: Digest; error?: string };
      if (!response.ok || !data.digest?.storyline || !data.digest.sections?.length) throw new Error(data.error || "Could not make a digest right now.");
      trackUsage({ name: "digest_created" });
      const sources = eligibleCasts.map(digestSource);
      const hashes = sources.map((cast) => cast.hash.toLowerCase());
      const nextSavedAt = Date.now();
      setDigest(data.digest);
      setDigestHashes(hashes);
      setDigestSources(sources);
      setSavedAt(nextSavedAt);
      setAudioRequested(false);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl("");
      try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, scope, digest: data.digest, hashes, sources, savedAt: nextSavedAt } satisfies StoredDigest)); } catch { setError("Digest created, but this browser could not save it locally. Check available site storage."); }
    } catch (e) {
      setError(providerError(e, "Gemini"));
    } finally {
      setBusy(false);
    }
  }

  function clearDigest() {
    setDigest(null);
    setDigestHashes([]);
    setDigestSources([]);
    setSavedAt(0);
    try { localStorage.removeItem(storageKey); } catch {}
    setError("");
    setAudioRequested(false);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
  }

  async function readAloud() {
    if (!digest || audioRequested || audioBusy) return;
    setAudioRequested(true);
    setAudioBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/speech", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: [digest.storyline, ...digest.sections.map((section) => `${section.title}: ${section.summary}`), ...digest.insights.map((insight) => `${insight.title}: ${insight.summary}`)].join("\n\n") }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || "Could not create audio right now.");
      }
      const audio = await response.blob();
      setAudioUrl(URL.createObjectURL(audio));
    } catch (e) {
      setError(providerError(e, "ElevenLabs"));
    } finally {
      setAudioBusy(false);
    }
  }

  const cited = (hashes: string[]) => hashes.map((hash) => sourceByHash.get(hash.toLowerCase())).filter((cast): cast is DigestSource => Boolean(cast));
  const analyzedSourceCasts = digestHashes.map((hash) => sourceByHash.get(hash)).filter((cast): cast is DigestSource => Boolean(cast));
  const sampleLabel = digestSources.length ? `${digestSources.length} posts · ${shortDate(digestSources[digestSources.length - 1].timestamp)}–${shortDate(digestSources[0].timestamp)}` : eligibleCasts.length ? `${eligibleCasts.length} posts · ${shortDate(eligibleCasts[eligibleCasts.length - 1].timestamp)}–${shortDate(eligibleCasts[0].timestamp)}` : "No posts in this period";

  return (
    <section id="ai-catch-up" className="ai-catchup" aria-label="AI feed catch-up" tabIndex={-1}>
      <div className="ai-catchup-top">
        <div>
          <strong>Weekly AI catch-up</strong>
          <p>A sourced summary of up to 40 posts from the selected range. The date span and count below show exactly what was analyzed.</p>
        </div>
        <div className="ai-catchup-actions">
          <button type="button" onClick={summarize} disabled={busy || eligibleCasts.length === 0 || !digestEnabled}>
            {busy ? "Analyzing…" : digest ? "Redo digest" : error ? "Retry digest" : digestEnabled ? `Analyze ${eligibleCasts.length} posts` : "AI not enabled"}
          </button>
          {digest && <details className="ai-catchup-menu"><summary aria-label="Digest options" title="Digest options">⋯</summary><div className="ai-catchup-menu-popover"><button type="button" onClick={clearDigest} disabled={busy || audioBusy}>Clear digest</button></div></details>}
        </div>
      </div>
      <div className="digest-scope" role="group" aria-label="Digest post range">
        <button type="button" className={scope === "week" ? "active" : ""} aria-pressed={scope === "week"} onClick={() => { setScope("week"); clearDigest(); }}>Last 7 days</button>
        <button type="button" className={scope === "loaded" ? "active" : ""} aria-pressed={scope === "loaded"} onClick={() => { setScope("loaded"); clearDigest(); }}>All loaded posts</button>
        <span>{sampleLabel}</span>
      </div>
      {digestEnabled && eligibleCasts.length === 0 && <p className="field-hint">No posts are available for this range yet. Load more feed posts or choose a range with recent activity, then try again.</p>}
      {digest && <div className="ai-digest-content" aria-live="polite">
        {savedAt > 0 && <small className="digest-saved-note">Saved on this device · {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(savedAt)}. This digest covers {digestSources.length} {scope === "week" ? "posts from the last seven days" : "loaded posts"} ({sampleLabel}); choose Redo digest to use newer posts.</small>}
        <div className="digest-metrics" aria-label="Activity snapshot">
          <div><strong>{digestSources.length}</strong><span>posts</span></div><div><strong>{analytics.people.length ? new Set(digestSources.map((cast) => cast.fid)).size : 0}</strong><span>people</span></div><div><strong>{analytics.likes.toLocaleString()}</strong><span>likes</span></div><div><strong>{analytics.recasts.toLocaleString()}</strong><span>recasts</span></div><div><strong>{analytics.replies.toLocaleString()}</strong><span>replies</span></div>
        </div>
        <section className="digest-activity"><div className="digest-subhead"><h3>Posting activity</h3><span>posts per day · sampled casts</span></div><div className="digest-bars">{analytics.days.map((day) => <div key={day.key} title={`${day.count} posts`}><span className="digest-bar-count">{day.count || ""}</span><i style={{ height: `${Math.max(4, (day.count / Math.max(1, ...analytics.days.map((item) => item.count))) * 54)}px` }} /><small>{day.label}</small></div>)}</div></section>
        <section className="ai-digest-story"><h3>The week in a nutshell</h3><p>{digest.storyline}</p><small>Based on {digestSources.length} supplied posts. Counts are a snapshot of current engagement.</small></section>
        {digest.insights.length > 0 && <section className="digest-insights"><div className="digest-subhead"><h3>Signals and insights</h3><span>Patterns grounded in these casts</span></div>{digest.insights.map((insight, index) => <article className="digest-insight" key={`${insight.title}-${index}`}><h4>{insight.title}</h4><p>{insight.summary}</p><SourceCasts casts={cited(insight.castHashes)} /></article>)}</section>}
        <section className="digest-topics"><div className="digest-subhead"><h3>What people talked about</h3><span>{digest.sections.length} themes</span></div>{digest.sections.map((section, index) => <article className="ai-digest-section" key={`${section.title}-${index}`}><h4>{section.title}</h4><p>{section.summary}</p><SourceCasts casts={cited(section.castHashes)} /></article>)}</section>
        <section className="digest-people"><div className="digest-subhead"><h3>Most active in this sample</h3><span>by posts · engagement</span></div><div className="digest-people-list">{analytics.people.map((person, index) => <div key={`${person.username}-${index}`}><span>{person.username ? <Link href={`/u/${encodeURIComponent(person.username)}`}>@{person.username}</Link> : person.name}</span><small>{person.posts} {person.posts === 1 ? "post" : "posts"} · {person.engagement.toLocaleString()} reactions and replies</small></div>)}</div></section>
        <section className="digest-top-posts"><div className="digest-subhead"><h3>Posts with the strongest response</h3><span>likes + 2× recasts + replies</span></div>{analytics.topPosts.map((cast) => <DigestPost key={cast.hash} cast={cast} />)}</section>
        <details className="digest-all-sources"><summary>Review all {analyzedSourceCasts.length} posts analyzed</summary><p>These are the exact posts Gemini received. Engagement figures are the current counts returned with the feed.</p><div>{analyzedSourceCasts.map((cast) => <DigestPost key={cast.hash} cast={cast} />)}</div></details>
        <small className="digest-source-note">This digest includes the saved source posts Gemini analyzed. Topic and insight links point to cited posts. Each post opens in Jackcaster.</small>
      </div>}
      {digest && audioEnabled && <div className="ai-catchup-audio"><button type="button" onClick={readAloud} disabled={audioBusy || audioRequested}>{audioBusy ? "Creating audio…" : audioUrl ? "Audio ready" : audioRequested ? "Audio attempt used" : "Read aloud"}</button>{audioUrl && <audio controls preload="none" src={audioUrl}>Audio playback is not supported in this browser.</audio>}{audioUrl && <a className="ai-catchup-download" href={audioUrl} download="jackcast-weekly-digest.mp3">Download MP3</a>}</div>}
      {error && <p className="ai-catchup-error" role="alert"><strong>Service status:</strong> {error}</p>}
      {!digestEnabled && <p className="field-hint">Add GOOGLE_AI_API_KEY to the server environment to enable AI catch-up.</p>}
      <small>Only the selected posts, author names, dates, and public engagement counts are sent to Google for the digest. Read aloud sends only the finished digest to ElevenLabs. Posts are treated as untrusted content and cannot trigger actions.</small>
    </section>
  );
}

function SourceCasts({ casts }: { casts: DigestSource[] }) {
  if (!casts.length) return <small className="digest-no-sources">No source posts were attached to this insight.</small>;
  return <div className="digest-source-casts">{casts.map((cast) => <DigestPost key={cast.hash} cast={cast} />)}</div>;
}

function DigestPost({ cast }: { cast: DigestSource }) {
  return <article className="digest-post"><div className="digest-post-head"><span>{cast.username ? <Link href={`/u/${encodeURIComponent(cast.username)}`}>@{cast.username}</Link> : cast.name}</span><time dateTime={cast.timestamp}>{shortDate(cast.timestamp)}</time></div><p>{withoutCastAttribution(cast.text) || "(Media cast)"}</p><div className="digest-post-foot"><span>♥ {cast.likes.toLocaleString()}</span><span>↻ {cast.recasts.toLocaleString()}</span><span>↩ {cast.replies.toLocaleString()}</span><Link href={`/cast/${encodeURIComponent(cast.hash)}`}>Open cast ↗</Link></div></article>;
}
