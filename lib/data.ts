import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { neynar, config } from "./neynar";
import { asCast, type Author, type CastView } from "./types";
import { getViewer, viewerOrThrow } from "./viewer";
import { getPrefs, effectiveMinScore } from "./prefs";
import { applyFilters } from "./filters";
import { MAX_TOP_ACCOUNTS } from "./prefs-shared";
import { CURATED_TOP_ACCOUNTS } from "./top-account-roster";

export type MiniAppSummary = { title: string; url: string; image?: string; author?: string; authorFid?: number; description?: string; category?: string };
export type MiniAppsOverview = { weekly: MiniAppSummary[]; relevant: MiniAppSummary[]; generatedAt: number };

function miniAppSummary(frame: { title?: string; frames_url: string; image?: string; author?: { fid?: number; username?: string; display_name?: string | null }; manifest?: { miniapp?: { name?: string; description?: string; icon_url?: string; screenshot_urls?: string[]; primary_category?: string }; frame?: { name?: string; description?: string; icon_url?: string; screenshot_urls?: string[]; primary_category?: string } }; metadata?: { html?: { ogDescription?: string; ogSiteName?: string } } }): MiniAppSummary {
  let url = "";
  try {
    const candidate = new URL(frame.frames_url);
    if (candidate.protocol === "https:" && candidate.hostname && !candidate.username && !candidate.password) url = candidate.toString();
  } catch { /* Ignore malformed third-party URLs. */ }
  const manifest = frame.manifest?.miniapp ?? frame.manifest?.frame;
  const imageCandidate = frame.image || manifest?.icon_url || manifest?.screenshot_urls?.[0];
  let image: string | undefined;
  try {
    const parsedImage = new URL(imageCandidate || "");
    if (parsedImage.protocol === "https:" && !parsedImage.username && !parsedImage.password) image = parsedImage.href.slice(0, 2048);
  } catch { /* A broken app icon falls back to the Jackcaster placeholder. */ }
  return {
    title: (frame.title || manifest?.name || frame.metadata?.html?.ogSiteName || new URL(url || "https://invalid.local").hostname).slice(0, 100),
    url,
    image,
    author: frame.author?.display_name || frame.author?.username,
    authorFid: frame.author?.fid,
    description: (manifest?.description || frame.metadata?.html?.ogDescription || "").slice(0, 240),
    category: manifest?.primary_category?.slice(0, 48),
  };
}

export const getMe = cache(async (): Promise<Author & { bio?: string }> => {
  const { fid } = await viewerOrThrow();
  const { users } = await neynar().fetchBulkUsers({ fids: [fid] });
  const u = users[0];
  return { ...(u as Author), bio: u?.profile?.bio?.text ?? "" };
});

/** Profile analytics are reused across range changes and quick revisits. */
const ownProfileAnalyticsCached = unstable_cache(
  async (fid: number) => {
    const [{ users }, result] = await Promise.all([
      neynar().fetchBulkUsers({ fids: [fid] }),
      neynar().fetchCastsForUser({ fid, viewerFid: fid, includeReplies: false, limit: 100 }),
    ]);
    return { user: users[0], casts: result.casts.map(asCast) };
  },
  ["own-profile-analytics-v1"],
  { revalidate: 300, tags: ["own-profile-analytics"] }
);

export async function ownProfileAnalytics(fid: number) {
  return ownProfileAnalyticsCached(fid);
}

/** Applies your quality dial and muted words. Returns what's left plus how many were hidden. */
export async function clean(casts: unknown[], myFid: number) {
  const prefs = await getPrefs();
  return applyFilters(casts.map(asCast), { myFid, minScore: effectiveMinScore(prefs), mutes: prefs.mutes, showReplies: prefs.showReplies, hideMiniApps: prefs.hideMiniApps });
}

export type Page = { casts: CastView[]; cursor: string | null; hidden: number };
export type MediaKind = "all" | "image" | "video" | "audio";
const NEYNAR_MAX_FEED_FIDS = 10;

function groupFeedFids(fids: number[]): number[][] {
  const groups: number[][] = [];
  for (let index = 0; index < fids.length; index += NEYNAR_MAX_FEED_FIDS) groups.push(fids.slice(index, index + NEYNAR_MAX_FEED_FIDS));
  return groups;
}

type RecastCursor = { version: 1; recasts: string | null; direct: string | null; directDone: boolean; excluded: [string, number][] };

function parseRecastCursor(value: string): RecastCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<RecastCursor>;
    if (parsed.version !== 1 || (typeof parsed.recasts !== "string" && parsed.recasts !== null) || (typeof parsed.direct !== "string" && parsed.direct !== null) || typeof parsed.directDone !== "boolean" || !Array.isArray(parsed.excluded)) return null;
    const excluded = parsed.excluded.filter((entry): entry is [string, number] => Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "number" && Number.isFinite(entry[1]));
    return { version: 1, recasts: parsed.recasts, direct: parsed.direct, directDone: parsed.directDone, excluded };
  } catch {
    return null;
  }
}

/** Newest first, strictly by time. */
function byTime(casts: CastView[]): CastView[] {
  return [...casts].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

export async function followingFeed(cursor?: string, limit = 30): Promise<Page> {
  const { fid } = await viewerOrThrow();
  const prefs = await getPrefs();
  const friendFids = new Set(prefs.friends.map((person) => person.fid));
  const res = await neynar().fetchUserFollowingFeed({ fid, viewerFid: fid, withRecasts: false, limit, cursor });
  const filtered = await clean(res.casts.filter((cast) => !friendFids.has(cast.author.fid)), fid);
  return { casts: byTime(filtered.casts), hidden: filtered.hidden, cursor: res.next?.cursor ?? null };
}

export async function channelFeed(channelId: string, cursor?: string, limit = 30): Promise<Page> {
  const { fid } = await viewerOrThrow();
  const res = await neynar().fetchFeedByChannelIds({
    channelIds: [channelId],
    viewerFid: fid,
    withRecasts: false,
    withReplies: false,
    limit,
    cursor,
  });
  const filtered = await clean(res.casts, fid);
  return { casts: byTime(filtered.casts), hidden: filtered.hidden, cursor: res.next?.cursor ?? null };
}

type MultiPeopleCursor = { version: 1; groups: string; cursors: (string | null)[] };

function parseMultiPeopleCursor(raw: string | undefined, groupKey: string, count: number): (string | null | undefined)[] {
  if (!raw || raw.length > 4096) return Array(count).fill(undefined);
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<MultiPeopleCursor>;
    if (parsed.version !== 1 || parsed.groups !== groupKey || !Array.isArray(parsed.cursors) || parsed.cursors.length !== count) return Array(count).fill(undefined);
    return parsed.cursors.map((value) => value === null ? null : typeof value === "string" && value.length <= 4096 ? value : undefined);
  } catch { return Array(count).fill(undefined); }
}

/** Chronological casts from a private people feed. Neynar accepts at most 10 FIDs per feed request. */
async function peopleFeed(people: { fid: number }[], cursor?: string, limit = 30, excludeFids: Set<number> = new Set()): Promise<Page> {
  const { fid } = await viewerOrThrow();
  const fids = [...new Set(people.map((person) => person.fid).filter((personFid) => Number.isSafeInteger(personFid) && personFid > 0))];
  if (!fids.length) return { casts: [], hidden: 0, cursor: null };
  const groups = groupFeedFids(fids);
  const groupKey = groups.map((group) => group.join(",")).join(";");
  const cursors = parseMultiPeopleCursor(cursor, groupKey, groups.length);
  const perGroupLimit = Math.ceil(limit / groups.length);
  const responses = await Promise.all(groups.map((group, index) => cursors[index] === null ? Promise.resolve(null) : neynar().fetchFeed({
    feedType: "filter", filterType: "fids", fids: group, viewerFid: fid,
    withRecasts: false, limit: perGroupLimit, cursor: cursors[index] ?? undefined,
  })));
  const nextCursors = responses.map((response) => response?.next?.cursor ?? null);
  const nextCursor = nextCursors.some(Boolean)
    ? Buffer.from(JSON.stringify({ version: 1, groups: groupKey, cursors: nextCursors } satisfies MultiPeopleCursor)).toString("base64url")
    : null;
  const uniqueCasts = new Map<string, CastView>();
  for (const response of responses) for (const cast of response?.casts ?? []) if (!excludeFids.has(cast.author.fid)) uniqueCasts.set(cast.hash, asCast(cast));
  const filtered = await clean([...uniqueCasts.values()], fid);
  return { casts: byTime(filtered.casts), hidden: filtered.hidden, cursor: nextCursor };
}

/** Recast-only view of the network feed. Neynar supplies casts added by the recast option, not the recaster identity. */
export async function recastsFeed(cursor?: string, limit = 100): Promise<Page> {
  const { fid } = await viewerOrThrow();
  const state = cursor ? parseRecastCursor(cursor) : null;
  const recastCursor = state?.recasts ?? (state ? undefined : cursor);
  const directCursor = state?.direct ?? undefined;
  const directDone = state?.directDone ?? false;
  const [withRecasts, direct] = await Promise.all([
    neynar().fetchUserFollowingFeed({ fid, viewerFid: fid, withRecasts: true, limit, cursor: recastCursor }),
    directDone
      ? Promise.resolve({ casts: [] as { hash: string }[], next: undefined })
      : neynar().fetchUserFollowingFeed({ fid, viewerFid: fid, withRecasts: false, limit, cursor: directCursor }),
  ]);
  const directHashes = new Set([...(state?.excluded ?? []).map(([hash]) => hash), ...direct.casts.map((cast) => cast.hash)]);
  const onlyRecasts = withRecasts.casts.filter((cast) => !directHashes.has(cast.hash));
  const filtered = await clean(onlyRecasts, fid);
  const timestamps = withRecasts.casts.map((cast) => Date.parse(cast.timestamp)).filter(Number.isFinite);
  const cutoff = timestamps.length ? Math.min(...timestamps) : Number.NEGATIVE_INFINITY;
  const excluded = new Map<string, number>();
  for (const [hash, timestamp] of [...(state?.excluded ?? []), ...direct.casts.map((cast) => [cast.hash, Date.parse("timestamp" in cast ? cast.timestamp : "")] as [string, number])]) {
    if (Number.isFinite(timestamp) && timestamp >= cutoff) excluded.set(hash, timestamp);
  }
  const nextState: RecastCursor | null = withRecasts.next?.cursor
    ? { version: 1, recasts: withRecasts.next.cursor, direct: direct.next?.cursor ?? null, directDone: !direct.next?.cursor, excluded: [...excluded.entries()] }
    : null;
  return {
    casts: filtered.casts.map((cast) => ({ ...cast, sharedByFollowed: true })),
    hidden: filtered.hidden,
    cursor: nextState ? Buffer.from(JSON.stringify(nextState)).toString("base64url") : null,
  };
}

export async function friendsFeed(cursor?: string, limit = 30): Promise<Page> {
  const prefs = await getPrefs();
  return peopleFeed(prefs.friends, cursor, limit);
}

export async function customFeed(cursor?: string, limit = 30): Promise<Page> {
  const prefs = await getPrefs();
  return peopleFeed(prefs.customPeople, cursor, limit, new Set(prefs.friends.map((person) => person.fid)));
}

function embedMediaKind(embed: CastView["embeds"][number]): Exclude<MediaKind, "all"> | null {
  const type = embed.metadata?.content_type?.toLowerCase() ?? "";
  if (type.startsWith("video/") || embed.metadata?.video) return "video";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("image/") || embed.metadata?.image) return "image";
  if (!embed.url) return null;
  try {
    const url = new URL(embed.url);
    const path = url.pathname.toLowerCase();
    if (/\.(mp4|webm|m3u8|mov)$/.test(path)) return "video";
    if (/\.(mp3|m4a|aac|ogg|oga|opus|wav|flac)$/.test(path)) return "audio";
    if (/\.(avif|gif|jpe?g|png|webp|heic)$/.test(path) || /(^|\.)imagedelivery\.net$/i.test(url.hostname)) return "image";
    return null;
  } catch { return null; }
}

function hasMedia(cast: CastView): boolean {
  return cast.embeds.some((embed) => embedMediaKind(embed) !== null);
}

export async function followingMediaFeed(kind: MediaKind = "all", cursor?: string, limit = 30): Promise<Page> {
  const { fid } = await viewerOrThrow();
  const prefs = await getPrefs();
  const friendFids = new Set(prefs.friends.map((person) => person.fid));
  const res = await neynar().fetchUserFollowingFeed({ fid, viewerFid: fid, withRecasts: false, limit, cursor });
  const candidates = res.casts.map(asCast).filter((cast) => cast.author.fid !== fid && !friendFids.has(cast.author.fid) && cast.embeds.some((embed) => {
    const media = embedMediaKind(embed);
    return media !== null && (kind === "all" || media === kind);
  }));
  const filtered = await clean(candidates, fid);
  return { casts: byTime(filtered.casts).slice(0, limit), hidden: filtered.hidden, cursor: res.next?.cursor ?? null };
}

export async function savedCasts(hashes: string[], viewerFid: number): Promise<CastView[]> {
  const safeHashes = hashes.filter((hash) => /^0x[0-9a-f]{40}$/i.test(hash)).slice(0, 30);
  if (!safeHashes.length) return [];
  const result = await neynar().fetchBulkCasts({ casts: safeHashes, viewerFid, sortType: "recent" });
  const byHash = new Map(result.result.casts.map((cast) => [cast.hash.toLowerCase(), asCast(cast)]));
  return safeHashes.flatMap((hash) => byHash.has(hash.toLowerCase()) ? [byHash.get(hash.toLowerCase())!] : []);
}

export async function userCasts(userFid: number, cursor?: string, mediaOnly = false): Promise<Page> {
  const { fid } = await viewerOrThrow();
  const casts: CastView[] = [];
  let nextCursor = cursor;
  // Media can be sparse in a profile. Walk a few pages so the media tab stays useful without
  // making one page load trigger an unbounded number of Neynar requests.
  for (let page = 0; page < (mediaOnly ? 5 : 1); page++) {
    const res = await neynar().fetchCastsForUser({ fid: userFid, viewerFid: fid, includeReplies: false, limit: 30, cursor: nextCursor });
    const batch = res.casts.map(asCast);
    casts.push(...(mediaOnly ? batch.filter(hasMedia) : batch));
    nextCursor = res.next?.cursor ?? undefined;
    if (!mediaOnly || casts.length >= 30 || !nextCursor || batch.length === 0) break;
  }
  return { casts, cursor: nextCursor ?? null, hidden: 0 };
}

export type ChannelChip = { id: string; name?: string; image_url?: string };
export type FollowedPerson = { fid: number; username: string; displayName: string };

export type RecentFriendSuggestion = { fid: number; username: string; posts: number; followers: number };
export type RecentFriendSuggestions = {
  people: RecentFriendSuggestion[];
  scanned: number;
  complete: boolean;
  generatedAt: number;
};

/** A bounded 90-day activity scan, cached per viewer for a day. */
const recentFriendSuggestionsCached = unstable_cache(
  async (fid: number, refreshKey?: number): Promise<RecentFriendSuggestions> => {
    void refreshKey;
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const activity = new Map<number, { fid: number; username: string; posts: number; followers: number; latest: number }>();
    let cursor: string | undefined;
    let scanned = 0;
    let reachedCutoff = false;
    let complete = false;
    for (let page = 0; page < 10; page++) {
      const result = await neynar().fetchUserFollowingFeed({ fid, viewerFid: fid, withRecasts: false, limit: 100, cursor });
      for (const raw of result.casts) {
        const cast = asCast(raw);
        const timestamp = Date.parse(cast.timestamp);
        if (!Number.isFinite(timestamp)) continue;
        if (timestamp < cutoff) {
          reachedCutoff = true;
          continue;
        }
        scanned++;
        const username = cast.author.username;
        if (cast.author.fid === fid || !username || !/^[a-z0-9_-]{1,32}$/i.test(username)) continue;
        const followerCount = Number((cast.author as typeof cast.author & { follower_count?: number }).follower_count ?? 0);
        const previous = activity.get(cast.author.fid);
        activity.set(cast.author.fid, {
          fid: cast.author.fid,
          username: username.toLowerCase(),
          posts: (previous?.posts ?? 0) + 1,
          followers: Math.max(previous?.followers ?? 0, Number.isFinite(followerCount) ? followerCount : 0),
          latest: Math.max(previous?.latest ?? 0, timestamp),
        });
      }
      cursor = result.next?.cursor ?? undefined;
      if (reachedCutoff || !cursor || !result.casts.length) {
        complete = true;
        break;
      }
    }
    const people = [...activity.values()]
      .sort((a, b) => b.posts - a.posts || b.followers - a.followers || b.latest - a.latest)
      .slice(0, MAX_TOP_ACCOUNTS)
      .map(({ fid: personFid, username, posts, followers }) => ({ fid: personFid, username, posts, followers }));
    return { people, scanned, complete, generatedAt: Date.now() };
  },
  ["recent-friend-suggestions-90d-v2"],
  { revalidate: 86400, tags: ["recent-friend-suggestions"] }
);

export async function recentFriendSuggestions(fid: number, refresh = false): Promise<RecentFriendSuggestions> {
  return recentFriendSuggestionsCached(fid, refresh ? Date.now() : undefined);
}

export type TopAccountLeader = { fid: number; username: string; displayName: string; pfpUrl: string; role: string };
export type TopAccountsSnapshot = {
  leaders: TopAccountLeader[];
  active: RecentFriendSuggestion[];
  scanned: number;
  complete: boolean;
  generatedAt: number;
};

const curatedTopAccountsCached = unstable_cache(async (): Promise<TopAccountLeader[]> => {
  const resolved: (TopAccountLeader | null)[] = [];
  for (let offset = 0; offset < CURATED_TOP_ACCOUNTS.length; offset += 8) {
    const batch = CURATED_TOP_ACCOUNTS.slice(offset, offset + 8);
    resolved.push(...await Promise.all(batch.map(async (seed) => {
      try {
        const { user } = await neynar().lookupUserByUsername({ username: seed.username });
        return { fid: user.fid, username: user.username.toLowerCase(), displayName: user.display_name || user.username, pfpUrl: user.pfp_url || "", role: String(seed.role) };
      } catch { return null; }
    })));
  }
  const unique = new Map<number, TopAccountLeader>();
  for (const person of resolved) if (person && !unique.has(person.fid)) unique.set(person.fid, person);
  return [...unique.values()];
}, ["jackcaster-curated-top-accounts-v2"], { revalidate: 604800, tags: ["curated-top-accounts"] });

/** Curated Farcaster leaders plus the viewer's most active followed accounts over a cached 90-day window. */
export async function topAccountsSnapshot(fid: number): Promise<TopAccountsSnapshot> {
  const [leaders, recent] = await Promise.allSettled([curatedTopAccountsCached(), recentFriendSuggestions(fid)]);
  const knownLeaders = leaders.status === "fulfilled" ? leaders.value : [];
  const activity = recent.status === "fulfilled" ? recent.value : { people: [], scanned: 0, complete: false, generatedAt: Date.now() };
  return { leaders: knownLeaders, active: activity.people, scanned: activity.scanned, complete: activity.complete, generatedAt: activity.generatedAt };
}

/** Chronological posts from the shared curated Farcaster roster; never personalized by follow graph. */
export async function topAccountsFeed(cursor?: string, limit = 30): Promise<Page> {
  const leaders = await curatedTopAccountsCached();
  return peopleFeed(leaders, cursor, limit);
}

export type SavedFriendActivity = { fid: number; username: string; posts: number; followers: number };
export type SavedFriendsActivity = { people: SavedFriendActivity[]; scanned: number; complete: boolean; generatedAt: number };

/** Check every saved Friends account together, with a weekly cache and bounded scan. */
const savedFriendsActivityCached = unstable_cache(
  async (viewerFid: number, people: { fid: number; username: string }[], refreshKey?: number): Promise<SavedFriendsActivity> => {
    void refreshKey;
    if (!people.length) return { people: [], scanned: 0, complete: true, generatedAt: Date.now() };
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const activity = new Map<number, { posts: number; followers: number }>();
    const groups = groupFeedFids([...new Set(people.map((person) => person.fid).filter((fid) => Number.isSafeInteger(fid) && fid > 0))]);
    const cursors: (string | undefined)[] = groups.map(() => undefined);
    const done = groups.map(() => false);
    const requestsByGroup = groups.map(() => 0);
    let scanned = 0;
    // Check every account group under a hard 10-request budget (up to 1,000 casts total).
    // Neynar's feed filter accepts at most 10 FIDs, and saved-Friends activity refreshes weekly.
    let requests = 0;
    while (requests < 10 && done.some((isDone) => !isDone)) {
      const pending = groups.map((group, index) => ({ group, index }))
        .filter(({ index }) => !done[index])
        .sort((a, b) => requestsByGroup[a.index] - requestsByGroup[b.index] || a.index - b.index)
        .slice(0, 10 - requests);
      const results = await Promise.all(pending.map(async ({ group, index }) => ({
        index,
        result: await neynar().fetchFeed({ feedType: "filter", filterType: "fids", fids: group, viewerFid, withRecasts: false, limit: 100, cursor: cursors[index] }),
      })));
      requests += results.length;
      for (const { index } of results) requestsByGroup[index]++;
      for (const { index, result } of results) {
        let reachedCutoff = false;
        for (const raw of result.casts) {
          const cast = asCast(raw);
          const timestamp = Date.parse(cast.timestamp);
          if (!Number.isFinite(timestamp)) continue;
          if (timestamp < cutoff) { reachedCutoff = true; continue; }
          scanned++;
          const author = cast.author as typeof cast.author & { follower_count?: number };
          const previous = activity.get(author.fid);
          const followers = Number(author.follower_count ?? 0);
          activity.set(author.fid, {
            posts: (previous?.posts ?? 0) + 1,
            followers: Math.max(previous?.followers ?? 0, Number.isFinite(followers) ? followers : 0),
          });
        }
        cursors[index] = result.next?.cursor ?? undefined;
        if (reachedCutoff || !cursors[index] || !result.casts.length) done[index] = true;
      }
    }
    return {
      people: people.map((person) => ({ ...person, posts: activity.get(person.fid)?.posts ?? 0, followers: activity.get(person.fid)?.followers ?? 0 }))
        .sort((a, b) => b.posts - a.posts || b.followers - a.followers || a.username.localeCompare(b.username)),
      scanned,
      complete: done.every(Boolean),
      generatedAt: Date.now(),
    };
  },
  ["saved-friends-activity-90d-v1"],
  { revalidate: 604800, tags: ["saved-friends-activity"] }
);

export async function savedFriendsActivity(fid: number, people: { fid: number; username: string }[], refresh = false): Promise<SavedFriendsActivity> {
  return savedFriendsActivityCached(fid, people, refresh ? Date.now() : undefined);
}

const weeklyMiniAppsCached = unstable_cache(
  async (): Promise<{ apps: MiniAppSummary[]; generatedAt: number }> => {
    const result = await neynar().fetchFrameCatalog({ limit: 30, timeWindow: "7d" });
    return { apps: result.frames.map((frame) => miniAppSummary(frame)).filter((app) => app.url), generatedAt: Date.now() };
  },
  ["weekly-mini-apps-7d-v2"],
  { revalidate: 604800, tags: ["mini-apps-overview"] }
);

const relevantMiniAppsCached = unstable_cache(
  async (fid: number): Promise<MiniAppSummary[]> => {
    const result = await neynar().fetchRelevantFrames({ viewerFid: fid, timeWindow: "7d" });
    return result.relevant_frames.map(({ frame }) => miniAppSummary(frame)).filter((app) => app.url);
  },
  ["relevant-mini-apps-7d-v2"],
  { revalidate: 604800, tags: ["mini-apps-overview"] }
);

export async function miniAppsOverview(fid: number): Promise<MiniAppsOverview> {
  const [weekly, relevant] = await Promise.all([weeklyMiniAppsCached(), relevantMiniAppsCached(fid)]);
  return { weekly: weekly.apps, relevant, generatedAt: weekly.generatedAt };
}

export async function searchMiniApps(query: string): Promise<MiniAppSummary[]> {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const result = await neynar().searchFrames({ q, limit: 20 });
  return result.frames.map((frame) => miniAppSummary(frame)).filter((app) => app.url);
}

/** Finds creator-attributed apps and recent embedded apps with a bounded, six-hour refresh. */
const ownMiniAppsCached = unstable_cache(
  async (fid: number): Promise<MiniAppSummary[]> => {
    const [{ users }, castResult, weekly, relevant] = await Promise.all([
      neynar().fetchBulkUsers({ fids: [fid] }),
      neynar().fetchCastsForUser({ fid, viewerFid: fid, includeReplies: false, limit: 100 }),
      weeklyMiniAppsCached(),
      relevantMiniAppsCached(fid),
    ]);
    const username = users[0]?.username?.trim().slice(0, 32);
    let searched = username ? await neynar().searchFrames({ q: username, limit: 100 }) : null;
    if (!searched?.frames.some((frame) => frame.author?.fid === fid)) {
      searched = await neynar().searchFrames({ q: String(fid), limit: 100 });
    }
    const found = new Map<string, MiniAppSummary>();
    const add = (app: MiniAppSummary) => { if (app.url && !found.has(app.url)) found.set(app.url, app); };

    for (const frame of searched?.frames ?? []) {
      if (frame.author?.fid === fid) add(miniAppSummary(frame));
    }
    for (const app of [...weekly.apps, ...relevant]) {
      if (app.authorFid === fid) add(app);
    }
    for (const raw of castResult.casts) {
      const cast = asCast(raw);
      for (const embed of cast.embeds ?? []) {
        const frame = embed.metadata?.frame as { frames_url?: string; title?: string; image?: string; author?: { fid?: number; username?: string; display_name?: string | null }; manifest?: { miniapp?: { name?: string; description?: string; icon_url?: string; primary_category?: string }; frame?: { name?: string; description?: string; icon_url?: string; primary_category?: string } }; metadata?: { html?: { ogDescription?: string } } } | undefined;
        if (!frame?.frames_url || frame.author?.fid !== fid) continue;
        add(miniAppSummary({ ...frame, frames_url: frame.frames_url }));
      }
    }
    return [...found.values()].slice(0, 100);
  },
  ["own-mini-apps-discovery-v2"],
  { revalidate: 21600, tags: ["own-mini-apps"] }
);

export async function ownMiniApps(fid: number): Promise<MiniAppSummary[]> {
  return ownMiniAppsCached(fid);
}

const followedPeopleCached = unstable_cache(
  async (fid: number): Promise<FollowedPerson[]> => {
    const out: FollowedPerson[] = [];
    let cursor: string | undefined;
    // Search a generous, bounded slice so settings stays quick and predictable.
    for (let page = 0; page < 20; page++) {
      const res = await neynar().fetchUserFollowing({ fid, viewerFid: fid, sortType: "desc_chron", limit: 100, cursor });
      out.push(...res.users.map(({ user }) => ({
        fid: user.fid,
        username: user.username.toLowerCase(),
        displayName: user.display_name || user.username,
      })));
      cursor = res.next?.cursor ?? undefined;
      if (!cursor || !res.users.length) break;
    }
    return Array.from(new Map(out.map((person) => [person.fid, person])).values());
  },
  ["followed-people-all"],
  { revalidate: 3600, tags: ["followed-people"] }
);

/** A bounded, briefly cached list used to search accounts you already follow. */
export async function followedPeople(): Promise<FollowedPerson[]> {
  const v = await getViewer();
  if (!v) return [];
  return followedPeopleCached(v.fid);
}

const followedChannelsCached = unstable_cache(
  async (fid: number): Promise<ChannelChip[]> => {
    // Neynar returns at most 100 per page, so walk the pages (up to 1,000 channels).
    const out: ChannelChip[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const res = await neynar().fetchUserChannels({ fid, limit: 100, cursor });
      out.push(...res.channels.map((c) => ({ id: c.id, name: c.name, image_url: c.image_url })));
      cursor = res.next?.cursor ?? undefined;
      if (!cursor || !res.channels.length) break;
    }
    return Array.from(new Map(out.map((c) => [c.id, c])).values());
  },
  ["followed-channels-all"],
  { revalidate: 3600, tags: ["followed-channels"] }
);

/**
 * Your favorite channels: the ones you picked on the You page, in the user's order.
 * Until you pick, PINNED_CHANNELS. They're the header tabs and the composer's channel menu.
 */
export async function tabChannels(): Promise<string[]> {
  const prefs = await getPrefs();
  return prefs.tabs ?? [...config.pinnedChannels].sort((a, b) => a.localeCompare(b));
}

/** The composer's channel menu: just your favorites. (The channel page you're on is added by the composer.) */
export async function composerChannels(): Promise<string[]> {
  return tabChannels();
}

/** For the tab picker: channels you follow (alphabetical) with names and images. */
export async function followedChannels(): Promise<ChannelChip[]> {
  const v = await getViewer();
  if (!v) return [];
  try {
    return [...(await followedChannelsCached(v.fid))].sort((a, b) => a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}
