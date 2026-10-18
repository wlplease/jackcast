import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { CHANNEL_ID, DEFAULT_PREFS, MAX_FRIENDS, MAX_MUTES, MAX_TABS, normalizeMute, type Prefs } from "./prefs-shared";
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
          .sort()
          .slice(0, MAX_TABS)
      : null;
    const theme = THEME_IDS.includes(p.theme as ThemeId) ? (p.theme as ThemeId) : DEFAULT_PREFS.theme;
    const mode = MODES.includes(p.mode as Mode) ? (p.mode as Mode) : DEFAULT_PREFS.mode;
    const density = p.density === "compact" ? "compact" : "comfortable";
    const showPreviews = p.showPreviews !== false;
    const cleanPeople = (value: unknown) => Array.isArray(value)
      ? value
          .map((entry) => ({ fid: Number(entry?.fid), username: String(entry?.username ?? "").trim().toLowerCase().replace(/^@/, "") }))
          .filter((entry) => Number.isSafeInteger(entry.fid) && entry.fid > 0 && /^[a-z0-9_-]{1,32}$/.test(entry.username))
          .filter((entry, index, all) => all.findIndex((x) => x.fid === entry.fid) === index)
          .slice(0, MAX_FRIENDS)
      : [];
    const friends = cleanPeople(p.friends);
    const friendFids = new Set(friends.map((person) => person.fid));
    // A Friends selection belongs only in Friends, even if an older settings
    // cookie also listed that account in the custom feed.
    const customPeople = cleanPeople(p.customPeople).filter((person) => !friendFids.has(person.fid));
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
    return { mutes, quality: q, showReplies: p.showReplies !== false, hideMiniApps: p.hideMiniApps === true, groupLinks: p.groupLinks !== false, density, showPreviews, tabs, friends, customPeople, customName, pinnedCastHash, savedMiniApps, theme, mode };
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
