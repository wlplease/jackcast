"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatsChart } from "@/components/StatsChart";
import { compact, timeAgo } from "@/lib/format";
import { computeStats, type StatsWindow } from "@/lib/stats";
import type { CastView } from "@/lib/types";
import { withoutCastAttribution } from "@/lib/cast-attribution";

const WINDOWS: { value: StatsWindow; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "loaded", label: "Loaded casts" },
];

export function ProfileAnalytics({ casts, followerCount }: { casts: CastView[]; followerCount: number }) {
  const [window, setWindow] = useState<StatsWindow>("30d");
  const stats = useMemo(() => computeStats(casts, window, followerCount), [casts, window, followerCount]);
  return <section className="me-section profile-analytics">
    <div className="me-section-head">
      <h2>Your casts</h2>
      <span className="meta">{stats.windowLabel} · {casts.length} loaded</span>
    </div>
    <div className="stats-range" role="group" aria-label="Analytics date range">
      {WINDOWS.map(({ value, label }) => <button key={value} type="button" className={`stats-range-link${window === value ? " active" : ""}`} aria-pressed={window === value} onClick={() => setWindow(value)}>{label}</button>)}
    </div>
    {stats.casts === 0 ? <p className="field-hint">No casts in this period. Try a longer range to see more activity.</p> : <>
      <div className="tiles">
        <div className="tile"><b>{compact(stats.casts)}</b><span>casts</span></div>
        <div className="tile"><b>{compact(stats.likes)}</b><span>likes</span></div>
        <div className="tile"><b>{compact(stats.recasts)}</b><span>recasts</span></div>
        <div className="tile"><b>{compact(stats.replies)}</b><span>replies</span></div>
        <div className="tile"><b>{stats.avg.toFixed(1)}</b><span>engagement per cast</span></div>
        <div className="tile"><b>{stats.engagementRate.toFixed(1)}%</b><span>engagement / followers</span></div>
        <div className="tile"><b>{compact(stats.mediaCasts)}</b><span>casts with media</span></div>
        {stats.bestCast && <div className="tile"><b>{compact(stats.bestCast.e)}</b><span>best cast engagement</span></div>}
      </div>
      <p className="field-hint">Top-level casts only. Engagement rate is reactions and replies divided by follower count; it estimates activity, not unique reach.</p>
      <StatsChart points={stats.points} />
      {stats.top.length > 0 && <>
        <h3 className="sub-head">What landed</h3>
        <ol className="top-casts">{stats.top.map((cast) => <li key={cast.hash}><Link href={`/cast/${cast.hash}`}>
          <span className="tc-text">{withoutCastAttribution(cast.text) || (cast.hasMedia ? "(photo or link)" : "(no text)")}</span>
          <span className="tc-meta">♥ {compact(cast.likes)} · ↻ {compact(cast.recasts)} · ↳ {compact(cast.replies)} · {timeAgo(cast.ts)}</span>
        </Link></li>)}</ol>
      </>}
    </>}
  </section>;
}
