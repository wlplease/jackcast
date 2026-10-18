import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { CHANNEL_ID, DEFAULT_PREFS, MAX_MUTES, MAX_TABS, normalizeMute, type Prefs } from "./prefs-shared";
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
    return { mutes, quality: q, recasts: p.recasts === true, tabs, theme, mode };
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
