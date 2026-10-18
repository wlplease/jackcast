"use client";

import { useEffect, useMemo, useState } from "react";
import type { StatPoint } from "@/lib/stats";

type Metric = "e" | "likes" | "recasts" | "replies" | "casts";
type Bucket = { label: string; long: string; n: number; avg: number };

const BLOCKS = [
  ["12a", "midnight to 3am"],
  ["3a", "3am to 6am"],
  ["6a", "6am to 9am"],
  ["9a", "9am to noon"],
  ["12p", "noon to 3pm"],
  ["3p", "3pm to 6pm"],
  ["6p", "6pm to 9pm"],
  ["9p", "9pm to midnight"],
] as const;
const DAYS = [
  ["Sun", "Sundays"],
  ["Mon", "Mondays"],
  ["Tue", "Tuesdays"],
  ["Wed", "Wednesdays"],
  ["Thu", "Thursdays"],
  ["Fri", "Fridays"],
  ["Sat", "Saturdays"],
] as const;

function bucketize(points: StatPoint[], keyOf: (d: Date) => number, defs: readonly (readonly [string, string])[], metric: Metric): Bucket[] {
  const acc = defs.map(([label, long]) => ({ label, long, n: 0, sum: 0 }));
  for (const p of points) {
    const b = acc[keyOf(new Date(p.ts))];
    b.n++;
    b.sum += metric === "casts" ? 1 : p[metric];
  }
  return acc.map(({ label, long, n, sum }) => ({ label, long, n, avg: n ? sum / n : 0 }));
}

function best(buckets: Bucket[]): Bucket | null {
  const eligible = buckets.filter((b) => b.n >= 2);
  if (!eligible.length) return null;
  return eligible.reduce((a, b) => (b.avg > a.avg ? b : a));
}

function Bars({ title, buckets, metric }: { title: string; buckets: Bucket[]; metric: Metric }) {
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, ...buckets.map((b) => b.avg));
  const top = best(buckets);
  const s = sel !== null ? buckets[sel] : null;
  return (
    <figure className="bars">
      <figcaption className="bars-title">{title}</figcaption>
      <div className="bars-plot" onMouseLeave={() => setSel(null)}>
        {buckets.map((b, i) => (
          <button
            key={b.label}
            type="button"
            className={`bar-col${sel === i ? " sel" : ""}${top === b ? " top" : ""}`}
            onMouseEnter={() => setSel(i)}
            onFocus={() => setSel(i)}
            onClick={() => setSel(sel === i ? null : i)}
            aria-label={`${b.long}: ${b.n} casts, ${b.avg.toFixed(1)} average ${metric === "casts" ? "casts" : metric === "e" ? "engagement" : metric}`}
          >
            <span className="bar-track">
              {b.n > 0 && <span className="bar" style={{ height: `${Math.max(4, (b.avg / max) * 100)}%` }} />}
            </span>
            <span className="bar-label">{b.label}</span>
          </button>
        ))}
      </div>
      <div className="bars-readout" aria-live="polite">
        {s ? (
          <>
            <b>{s.long}</b> · {s.n} {s.n === 1 ? "cast" : "casts"}
            {s.n ? ` · ${s.avg.toFixed(1)} avg ${metric === "casts" ? "casts" : metric === "e" ? "engagement" : metric}` : ""}
          </>
        ) : top ? (
          <>
          Best: <b>{top.long}</b> · {top.avg.toFixed(1)} avg {metric === "casts" ? "casts" : metric === "e" ? "engagement" : metric}
          </>
        ) : (
          "Cast a bit more to see a pattern."
        )}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>When</th>
            <th>Casts</th>
            <th>Average engagement</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.label}>
              <td>{b.long}</td>
              <td>{b.n}</td>
              <td>{b.avg.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Buckets in your own time zone, which is why this runs in the browser. */
export function StatsChart({ points }: { points: StatPoint[] }) {
  const [ready, setReady] = useState(false);
  const [metric, setMetric] = useState<Metric>("e");
  useEffect(() => setReady(true), []);
  const byTime = useMemo(() => bucketize(points, (d) => Math.floor(d.getHours() / 3), BLOCKS, metric), [points, metric]);
  const byDay = useMemo(() => bucketize(points, (d) => d.getDay(), DAYS, metric), [points, metric]);
  if (!ready) return <div className="bars-grid" style={{ minHeight: 210 }} />;
  return (
    <section className="stats-chart-section" aria-label="Analytics charts">
      <label className="stats-metric-picker">Chart metric <select value={metric} onChange={(event) => setMetric(event.target.value as Metric)}>
        <option value="e">Total engagement</option><option value="likes">Likes</option><option value="recasts">Recasts</option><option value="replies">Replies</option><option value="casts">Casts</option>
      </select></label>
      <div className="bars-grid">
        <Bars title={`${metric === "e" ? "Engagement" : metric === "casts" ? "Casts" : metric} by time of day`} buckets={byTime} metric={metric} />
        <Bars title={`${metric === "e" ? "Engagement" : metric === "casts" ? "Casts" : metric} by day`} buckets={byDay} metric={metric} />
      </div>
    </section>
  );
}
