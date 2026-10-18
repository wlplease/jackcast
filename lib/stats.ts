import type { CastView } from "./types";

export type StatPoint = { ts: string; e: number };
export type TopCast = { hash: string; text: string; ts: string; likes: number; recasts: number; replies: number; e: number; hasMedia: boolean };

export type Stats = {
  /** "30 days" or "your last N casts" */
  windowLabel: string;
  casts: number;
  likes: number;
  recasts: number;
  replies: number;
  avg: number;
  top: TopCast[];
  points: StatPoint[];
};

const DAY = 86_400_000;

export function engagement(c: CastView) {
  return (c.reactions?.likes_count ?? 0) + (c.reactions?.recasts_count ?? 0) + (c.replies?.count ?? 0);
}

/** Your top-level casts from the last 30 days (or your most recent ones, if you've been quiet). */
export function computeStats(all: CastView[], now = Date.now()): Stats {
  let windowLabel = "last 30 days";
  let casts = all.filter((c) => now - Date.parse(c.timestamp) <= 30 * DAY);
  if (casts.length < 5 && all.length > casts.length) {
    casts = all.slice(0, 30);
    windowLabel = `your last ${casts.length} casts`;
  }
  const sum = (f: (c: CastView) => number) => casts.reduce((a, c) => a + f(c), 0);
  const likes = sum((c) => c.reactions?.likes_count ?? 0);
  const recasts = sum((c) => c.reactions?.recasts_count ?? 0);
  const replies = sum((c) => c.replies?.count ?? 0);
  const top = [...casts]
    .sort((a, b) => engagement(b) - engagement(a))
    .slice(0, 5)
    .filter((c) => engagement(c) > 0)
    .map((c) => ({
      hash: c.hash,
      text: c.text,
      ts: c.timestamp,
      likes: c.reactions?.likes_count ?? 0,
      recasts: c.reactions?.recasts_count ?? 0,
      replies: c.replies?.count ?? 0,
      e: engagement(c),
      hasMedia: (c.embeds ?? []).length > 0,
    }));
  return {
    windowLabel,
    casts: casts.length,
    likes,
    recasts,
    replies,
    avg: casts.length ? (likes + recasts + replies) / casts.length : 0,
    top,
    points: casts.map((c) => ({ ts: c.timestamp, e: engagement(c) })),
  };
}
