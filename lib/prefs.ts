import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { BUILTIN_FEED_ORDER, CHANNEL_ID, DEFAULT_FEED_NAMES, DEFAULT_PREFS, DEFAULT_SAVED_COLLECTIONS, MAX_AUDIO_TRACKS, MAX_CUSTOM_PEOPLE, MAX_FRIENDS, MAX_MUTES, MAX_SAVED_CASTS, MAX_SAVED_COLLECTIONS, MAX_TABS, normalizeMute, type BuiltinFeedKey, type OptionalService, type Prefs } from "./prefs-shared";
import { MODES, THEME_IDS, type Mode, type ThemeId } from "./themes";

export const PREFS_COOKIE = "selfcaster_prefs";

export function parsePrefs(raw: string | undefined): Prefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const p = JSON.parse(raw) as Partial<Prefs>;
    const mutes = Array.isArray(p.mutes)
      ? Array.from(new Set(p.mutes.map((m) => normalizeMute(String(m))).filter((m): m is string => !!m))).slice(0, MAX_MUTES)
      : [];
    const q = typeof p.quality === "number" && p.quality >= 0 && p.quality <= 1 ? p.quality : null;
    const tabs = Array.isArray(p.tabs)
      ? Array.from(new Set(p.tabs.map((t) => String(t).trim().toLowerCase().replace(/^\//, "")).filter((t) => CHANNEL_ID.test(t))))
          .slice(0, MAX_TABS)
      : null;
    const theme = THEME_IDS.includes(p.theme as ThemeId) ? (p.theme as ThemeId) : DEFAULT_PREFS.theme;
    const mode = MODES.includes(p.mode as Mode) ? (p.mode as Mode) : DEFAULT_PREFS.mode;
    const density = p.density === "compact" ? "compact" : "comfortable";
    const showPreviews = p.showPreviews !== false;
    const allowedServices: OptionalService[] = ["gemini", "elevenlabs", "giphy", "dms", "map", "analytics"];
    const disabledServices = Array.isArray(p.disabledServices)
      ? [...new Set(p.disabledServices.filter((service): service is OptionalService => allowedServices.includes(service as OptionalService)))]
      : [];
    const feedNames = Object.fromEntries(Object.entries(DEFAULT_FEED_NAMES).map(([key, fallback]) => {
      const value = p.feedNames && typeof p.feedNames === "object" ? (p.feedNames as Record<string, unknown>)[key] : undefined;
      const clean = typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 18) : "";
      return [key, clean || fallback];
    })) as Prefs["feedNames"];
    const feedOrder = Array.isArray(p.feedOrder)
      ? [...new Set(p.feedOrder.filter((key): key is BuiltinFeedKey => BUILTIN_FEED_ORDER.includes(key as BuiltinFeedKey)))].concat(BUILTIN_FEED_ORDER.filter((key) => !p.feedOrder!.includes(key)))
      : BUILTIN_FEED_ORDER;
    const hiddenFeeds = Array.isArray(p.hiddenFeeds)
      ? [...new Set(p.hiddenFeeds.filter((key): key is BuiltinFeedKey => BUILTIN_FEED_ORDER.includes(key as BuiltinFeedKey) && key !== "following"))]
      : [];
    const cleanPeople = (value: unknown, limit: number) => Array.isArray(value)
      ? value
          .map((entry) => ({ fid: Number(entry?.fid), username: String(entry?.username ?? "").trim().toLowerCase().replace(/^@/, "") }))
          .filter((entry) => Number.isSafeInteger(entry.fid) && entry.fid > 0 && /^[a-z0-9_-]{1,32}$/.test(entry.username))
          .filter((entry, index, all) => all.findIndex((x) => x.fid === entry.fid) === index)
          .slice(0, limit)
      : [];
    const friends = cleanPeople(p.friends, MAX_FRIENDS);
    const friendFids = new Set(friends.map((person) => person.fid));
    // A Friends selection belongs only in Friends, even if an older settings
    // cookie also listed that account in the custom feed.
    const customPeople = cleanPeople(p.customPeople, MAX_CUSTOM_PEOPLE).filter((person) => !friendFids.has(person.fid));
    const customName = typeof p.customName === "string"
      ? p.customName.trim().replace(/\s+/g, " ").slice(0, 18) || DEFAULT_PREFS.customName
      : DEFAULT_PREFS.customName;
    const pinnedCastHash = typeof p.pinnedCastHash === "string" && /^0x[0-9a-f]{40}$/i.test(p.pinnedCastHash)
      ? p.pinnedCastHash.toLowerCase()
      : null;
    const savedMiniApps = Array.isArray(p.savedMiniApps)
      ? Array.from(new Map(p.savedMiniApps.slice(0, 6).flatMap((entry) => {
          const url = typeof entry?.url === "string" ? entry.url.trim() : "";
          const title = typeof entry?.title === "string" ? entry.title.trim().slice(0, 64) : "";
          try {
            const parsed = new URL(url);
            return parsed.protocol === "https:" && parsed.href.length <= 192 && !parsed.username && !parsed.password && title ? [[parsed.toString(), { url: parsed.toString(), title }] as const] : [];
          } catch { return []; }
        })).values())
      : [];
    const audioTracks = Array.isArray(p.audioTracks)
      ? Array.from(new Map(p.audioTracks.slice(0, MAX_AUDIO_TRACKS).flatMap((entry) => {
          const url = typeof entry?.url === "string" ? entry.url.trim() : "";
          const title = typeof entry?.title === "string" ? entry.title.trim().replace(/\s+/g, " ").slice(0, 48) : "";
          try {
            const parsed = new URL(url);
            return parsed.protocol === "https:" && parsed.href.length <= 512 && !parsed.username && !parsed.password && title ? [[parsed.toString(), { url: parsed.toString(), title }] as const] : [];
          } catch { return []; }
        })).values())
      : [];
    const savedCasts = Array.isArray(p.savedCasts)
      ? Array.from(new Set(p.savedCasts.filter((hash): hash is string => typeof hash === "string" && /^0x[0-9a-f]{40}$/i.test(hash)).map((hash) => hash.toLowerCase()))).slice(0, MAX_SAVED_CASTS)
      : [];
    const savedCollections = Array.isArray(p.savedCollections)
      ? [{ ...DEFAULT_SAVED_COLLECTIONS[0] }, ...p.savedCollections.filter((entry) => entry && typeof entry.id === "string" && entry.id !== "inbox" && /^[a-z0-9-]{1,24}$/.test(entry.id) && typeof entry.name === "string")
          .map((entry) => ({ id: entry.id, name: entry.name.trim().replace(/\s+/g, " ").slice(0, 28) }))
          .filter((entry) => entry.name && !DEFAULT_SAVED_COLLECTIONS.some((item) => item.name.toLowerCase() === entry.name.toLowerCase()))
          .filter((entry, index, all) => all.findIndex((item) => item.id === entry.id) === index)
          .slice(0, MAX_SAVED_COLLECTIONS - 1)]
      : DEFAULT_SAVED_COLLECTIONS;
    const collectionIds = new Set(savedCollections.map((collection) => collection.id));
    const savedCastCollections = Array.isArray(p.savedCastCollections)
      ? Array.from(new Map(p.savedCastCollections.filter((entry) => entry && typeof entry.hash === "string" && /^0x[0-9a-f]{40}$/i.test(entry.hash) && typeof entry.collectionId === "string" && entry.collectionId !== "inbox" && collectionIds.has(entry.collectionId) && savedCasts.includes(entry.hash.toLowerCase()))
          .map((entry) => [entry.hash.toLowerCase(), { hash: entry.hash.toLowerCase(), collectionId: entry.collectionId }] as const)).values())
      : [];
    return { disabledServices, feedNames, feedOrder, hiddenFeeds, mutes, quality: q, showReplies: p.showReplies !== false, hideMiniApps: p.hideMiniApps === true, groupLinks: p.groupLinks !== false, density, showPreviews, tabs, friends, customPeople, customName, pinnedCastHash, savedMiniApps, savedCasts, savedCollections, savedCastCollections, audioTracks, theme, mode };
  } catch {
    return DEFAULT_PREFS;
  }
}

export const getPrefs = cache(async (): Promise<Prefs> => {
  const jar = await cookies();
  return parsePrefs(jar.get(PREFS_COOKIE)?.value);
});

/** The score threshold actually in effect: your setting, else the env default. */
export function effectiveMinScore(prefs: Prefs): number {
  if (prefs.quality !== null) return prefs.quality;
  const env = Number(process.env.MIN_USER_SCORE ?? "0");
  return Number.isFinite(env) ? env : 0;
}
