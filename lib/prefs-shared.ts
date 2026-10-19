// Settings shapes shared by server and browser. Stored per device in a cookie.
import type { Mode, ThemeId } from "./themes";

export type Prefs = {
  /** Words, phrases, $tickers, #tags or @handles to hide. Lowercased. */
  mutes: string[];
  /** Minimum Neynar user score to show (0 to 1). null means use MIN_USER_SCORE from env. */
  quality: number | null;
  /** Include replies in Following and curated feeds. */
  showReplies: boolean;
  /** Hide posts with a detected Farcaster mini app embed. */
  hideMiniApps: boolean;
  /** Collapse posts with the exact same normalized external link into expandable groups. */
  groupLinks: boolean;
  /** Comfortable or compact spacing across feed cards. */
  density: "comfortable" | "compact";
  /** Render image, video, audio, and link embed previews in casts. */
  showPreviews: boolean;
  /** Channel tabs you picked, in the order shown in the feed and composer. null means "use the channels you follow". */
  tabs: string[] | null;
  /** People included in the private Friends feed. */
  friends: { fid: number; username: string }[];
  /** People included in the additional private custom feed. */
  customPeople: { fid: number; username: string }[];
  /** Name for the additional feed tab, such as Builders or Local. */
  customName: string;
  /** Optional app-local pinned cast on this deployment's profile page. */
  pinnedCastHash: string | null;
  /** Mini apps saved to this device. */
  savedMiniApps: { url: string; title: string }[];
  /** Cast hashes saved to this device's private reading list. */
  savedCasts: string[];
  /** Optional personal audio playlist, stored in this device's settings cookie. */
  audioTracks: { url: string; title: string }[];
  /** Color theme (see lib/themes.ts). */
  theme: ThemeId;
  /** auto follows the system; light and dark pin it. */
  mode: Mode;
};

export const DEFAULT_PREFS: Prefs = { mutes: [], quality: null, showReplies: true, hideMiniApps: false, groupLinks: true, density: "comfortable", showPreviews: true, tabs: null, friends: [], customPeople: [], customName: "Custom", pinnedCastHash: null, savedMiniApps: [], savedCasts: [], audioTracks: [], theme: "selfcaster", mode: "auto" };

export const MAX_TABS = 20;
export const MAX_FRIENDS = 50;
export const MAX_CUSTOM_PEOPLE = 20;
export const MAX_TOP_ACCOUNTS = 20;
export const MAX_AUDIO_TRACKS = 3;
export const MAX_SAVED_CASTS = 30;
export const CHANNEL_ID = /^[a-z0-9-]{1,32}$/;

export const QUALITY_LEVELS = [
  { value: 0, label: "Off", hint: "Show everyone" },
  { value: 0.2, label: "Light", hint: "Hide obvious bots" },
  { value: 0.5, label: "Balanced", hint: "Hide most low-effort accounts" },
  { value: 0.8, label: "Strict", hint: "Only well-established accounts" },
] as const;

export const MAX_MUTES = 60;

export function normalizeMute(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t || t.length > 40) return null;
  return t;
}
