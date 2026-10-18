import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { neynar, config } from "./neynar";
import { asCast, type Author, type CastView } from "./types";
import { getViewer, viewerOrThrow } from "./viewer";
import { getPrefs, effectiveMinScore } from "./prefs";
import { applyFilters } from "./filters";

export const getMe = cache(async (): Promise<Author & { bio?: string }> => {
  const { fid } = await viewerOrThrow();
  const { users } = await neynar().fetchBulkUsers({ fids: [fid] });
  const u = users[0];
  return { ...(u as Author), bio: u?.profile?.bio?.text ?? "" };
});

/** Applies your quality dial and muted words. Returns what's left plus how many were hidden. */
export async function clean(casts: unknown[], myFid: number) {
  const prefs = await getPrefs();
  return applyFilters(casts.map(asCast), { myFid, minScore: effectiveMinScore(prefs), mutes: prefs.mutes });
}

export type Page = { casts: CastView[]; cursor: string | null; hidden: number };

/** Newest first, strictly by time. */
function byTime(casts: CastView[]): CastView[] {
  return [...casts].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

export async function followingFeed(cursor?: string, limit = 30): Promise<Page> {
  const { fid } = await viewerOrThrow();
  const prefs = await getPrefs();
  const res = await neynar().fetchUserFollowingFeed({ fid, viewerFid: fid, withRecasts: prefs.recasts, limit, cursor });
  const filtered = await clean(res.casts, fid);
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

/** Chronological casts from the people selected for this device's private Friends feed. */
async function peopleFeed(people: { fid: number }[], cursor?: string, limit = 30): Promise<Page> {
  const { fid } = await viewerOrThrow();
  const prefs = await getPrefs();
  const fids = people.map((person) => person.fid);
  if (!fids.length) return { casts: [], hidden: 0, cursor: null };
  const res = await neynar().fetchFeed({
    feedType: "filter",
    filterType: "fids",
    fids,
    viewerFid: fid,
    withRecasts: prefs.recasts,
    limit,
    cursor,
  });
  const filtered = await clean(res.casts, fid);
  return { casts: byTime(filtered.casts), hidden: filtered.hidden, cursor: res.next?.cursor ?? null };
}

export async function friendsFeed(cursor?: string, limit = 30): Promise<Page> {
  const prefs = await getPrefs();
  return peopleFeed(prefs.friends, cursor, limit);
}

export async function customFeed(cursor?: string, limit = 30): Promise<Page> {
  const prefs = await getPrefs();
  return peopleFeed(prefs.customPeople, cursor, limit);
}

function hasMedia(cast: CastView): boolean {
  return cast.embeds.some((embed) => {
    if (embed.metadata?.content_type?.startsWith("image/") || embed.metadata?.content_type?.startsWith("video/") || embed.metadata?.image || embed.metadata?.video) return true;
    if (!embed.url) return false;
    try {
      const url = new URL(embed.url);
      return /\.(avif|gif|jpe?g|png|webp|mp4|webm|m3u8|mov)(?:$|[?#])/i.test(url.pathname + url.search) || /(^|\.)imagedelivery\.net$/i.test(url.hostname);
    } catch {
      return false;
    }
  });
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

export async function unseenCount(): Promise<number> {
  try {
    const v = await getViewer();
    if (!v) return 0;
    const res = await neynar().fetchAllNotifications({ fid: v.fid, limit: 1 });
    return res.unseen_notifications_count ?? 0;
  } catch {
    return 0;
  }
}

export type ChannelChip = { id: string; name?: string; image_url?: string };

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
  { revalidate: 600, tags: ["followed-channels"] }
);

/**
 * Your favorite channels: the ones you picked on the You page, A to Z.
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
