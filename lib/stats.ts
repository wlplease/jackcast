import type { CastView } from "./types";

export type StatPoint = { ts: string; e: number; likes: number; recasts: number; replies: number };
export type TopCast = { hash: string; text: string; ts: string; likes: number; recasts: number; replies: number; e: number; hasMedia: boolean };
export type StatsWindow = "7d" | "30d" | "90d" | "loaded";

export type Stats = {
  /** Selected date range or latest loaded sample. */
  windowLabel: string;
  casts: number;
  likes: number;
  recasts: number;
  replies: number;
  avg: number;
  engagementRate: number;
  mediaCasts: number;
  bestCast: TopCast | null;
  top: TopCast[];
  points: StatPoint[];
};

const DAY = 86_400_000;

export function engagement(c: CastView) {
  return (c.reactions?.likes_count ?? 0) + (c.reactions?.recasts_count ?? 0) + (c.replies?.count ?? 0);
}

/** Analytics for a chosen window, bounded to the casts supplied by the profile page. */
export function computeStats(all: CastView[], window: StatsWindow = "30d", followerCount = 0, now = Date.now()): Stats {
  const days = window === "7d" ? 7 : window === "90d" ? 90 : 30;
  const windowLabel = window === "loaded" ? `latest ${all.length} loaded casts` : `last ${days} days`;
  const casts = window === "loaded" ? all : all.filter((c) => {
    const age = now - Date.parse(c.timestamp);
    return Number.isFinite(age) && age >= 0 && age <= days * DAY;
  });
  const sum = (f: (c: CastView) => number) => casts.reduce((a, c) => a + f(c), 0);
  const likes = sum((c) => c.reactions?.likes_count ?? 0);
  const recasts = sum((c) => c.reactions?.recasts_count ?? 0);
  const replies = sum((c) => c.replies?.count ?? 0);
  const topCasts = [...casts]
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
    engagementRate: casts.length && followerCount > 0 ? (likes + recasts + replies) / (casts.length * followerCount) * 100 : 0,
    mediaCasts: casts.filter((c) => (c.embeds ?? []).length > 0).length,
    bestCast: topCasts[0] ?? null,
    top: topCasts,
    points: casts.map((c) => ({ ts: c.timestamp, e: engagement(c), likes: c.reactions?.likes_count ?? 0, recasts: c.reactions?.recasts_count ?? 0, replies: c.replies?.count ?? 0 })),
  };
}
