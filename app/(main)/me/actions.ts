"use server";

import { cookies } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import { neynar } from "@/lib/neynar";
import { getViewer } from "@/lib/viewer";
import { PREFS_COOKIE, getPrefs, parsePrefs } from "@/lib/prefs";
import { followedPeople as getFollowedPeople, recentFriendSuggestions, savedFriendsActivity, ownMiniApps, topAccountsSnapshot } from "@/lib/data";
import { CHANNEL_ID, MAX_FRIENDS, MAX_SAVED_CASTS, MAX_TOP_ACCOUNTS, type Prefs } from "@/lib/prefs-shared";

/** Saves only the fields you pass, merged over what's already stored, so separate settings forms can't clobber each other. */
export async function savePrefs(patch: Partial<Prefs>): Promise<{ ok: true; prefs: Prefs } | { ok: false; error: string }> {
  const current = await getPrefs();
  // Re-parse so only clean, bounded values ever reach the cookie.
  const prefs = parsePrefs(JSON.stringify({ ...current, ...patch }));
  const serialized = JSON.stringify(prefs);
  if (new TextEncoder().encode(serialized).length > 3800) {
    return { ok: false, error: "Your device settings are too large to save. Remove a few mute terms or people from your feeds and try again." };
  }
  const jar = await cookies();
  jar.set(PREFS_COOKIE, serialized, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2,
  });
  revalidatePath("/", "layout");
  return { ok: true, prefs };
}

export async function toggleSavedCast(hash: string): Promise<{ ok: true; saved: boolean } | { ok: false; error: string }> {
  if (!/^0x[0-9a-f]{40}$/i.test(hash)) return { ok: false, error: "That cast link is not valid." };
  const normalized = hash.toLowerCase();
  const prefs = await getPrefs();
  const exists = prefs.savedCasts.includes(normalized);
  if (!exists && prefs.savedCasts.length >= MAX_SAVED_CASTS) return { ok: false, error: `Your saved list is full (${MAX_SAVED_CASTS}). Remove a cast first.` };
  const result = await savePrefs({ savedCasts: exists ? prefs.savedCasts.filter((item) => item !== normalized) : [normalized, ...prefs.savedCasts] });
  return result.ok ? { ok: true, saved: !exists } : { ok: false, error: result.error };
}

const bytes = (s: string) => new TextEncoder().encode(s).length;

function neynarFailure(error: unknown, fallback: string): string {
  const value = error && typeof error === "object" ? error as { status?: unknown; response?: { status?: unknown }; message?: unknown } : {};
  const status = Number(value.status ?? value.response?.status ?? 0);
  const message = typeof value.message === "string" ? value.message : "";
  if (/Missing env var NEYNAR_API_KEY/i.test(message)) return "Neynar is not configured. Add NEYNAR_API_KEY to the server environment and redeploy.";
  if (status === 401 || status === 403) return "Neynar rejected this request. Check the API key and Farcaster account connection.";
  if (status === 429) return "Neynar rate limit reached. Wait a moment before trying again.";
  if (status >= 500 || /fetch failed|network|timed? ?out/i.test(message)) return "Neynar is temporarily unavailable. Try again shortly.";
  return fallback;
}

export async function updateProfile(input: {
  displayName?: string;
  bio?: string;
  pfpUrl?: string;
  bannerUrl?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = await getViewer();
  if (!v?.signerUuid) return { ok: false, error: "Connect your account at /setup first." };

  const patch: { displayName?: string; bio?: string; pfpUrl?: string; banner?: string } = {};
  if (input.displayName !== undefined) {
    const d = input.displayName.trim();
    if (!d) return { ok: false, error: "Display name can't be empty." };
    if (bytes(d) > 32) return { ok: false, error: "Display name is too long (32 bytes max)." };
    patch.displayName = d;
  }
  if (input.bio !== undefined) {
    const b = input.bio.trim();
    if (bytes(b) > 256) return { ok: false, error: "Bio is too long (256 bytes max)." };
    patch.bio = b;
  }
  if (input.pfpUrl !== undefined) {
    if (!/^https:\/\//.test(input.pfpUrl) || input.pfpUrl.length > 256) return { ok: false, error: "That photo URL won't work." };
    patch.pfpUrl = input.pfpUrl;
  }
  if (input.bannerUrl !== undefined) {
    const banner = input.bannerUrl.trim();
    if (banner && (!/^https:\/\//i.test(banner) || banner.length > 512)) return { ok: false, error: "Cover image must be an HTTPS URL under 512 characters." };
    patch.banner = banner;
  }
  if (!Object.keys(patch).length) return { ok: true };

  try {
    await neynar().updateUser({ signerUuid: v.signerUuid, ...patch });
    revalidateTag("own-profile-analytics");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: neynarFailure(e, "Couldn't update your profile. Check your connection and try again.") };
  }
}

/** Confirms a channel exists before it becomes a tab. Returns its canonical id. */
export async function checkChannel(raw: string): Promise<{ ok: true; id: string; name?: string } | { ok: false; error: string }> {
  const id = raw.trim().toLowerCase().replace(/^\//, "");
  if (!CHANNEL_ID.test(id)) return { ok: false, error: "Channel ids are letters, numbers and dashes." };
  try {
    const { channel } = await neynar().lookupChannel({ id });
    return { ok: true, id: channel.id, name: channel.name };
  } catch (error) {
    return { ok: false, error: neynarFailure(error, `Couldn't find /${id}.`) };
  }
}

/** Resolve a Farcaster username before adding it to this device's Friends feed. */
export async function checkFriend(raw: string): Promise<{ ok: true; fid: number; username: string } | { ok: false; error: string }> {
  const username = raw.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_-]{1,32}$/.test(username)) return { ok: false, error: "Enter a valid Farcaster username." };
  try {
    const { user } = await neynar().lookupUserByUsername({ username });
    return { ok: true, fid: user.fid, username: user.username.toLowerCase() };
  } catch (error) {
    return { ok: false, error: neynarFailure(error, `Couldn't find @${username}.`) };
  }
}

/** Ranks followed accounts by post activity over the last 90 days, with a bounded scan. */
export async function suggestRecentFriends(refresh = false): Promise<{ ok: true; people: { fid: number; username: string; posts: number; followers: number }[]; scanned: number; complete: boolean; generatedAt: number } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Connect your account at /setup first." };
  try {
    return { ok: true, ...await recentFriendSuggestions(viewer.fid, refresh) };
  } catch (error) {
    return { ok: false, error: neynarFailure(error, "Couldn't scan your recent feed. Check your Neynar connection and try again.") };
  }
}

export async function checkSavedFriendsActivity(refresh = false): Promise<{ ok: true; people: { fid: number; username: string; posts: number; followers: number }[]; scanned: number; complete: boolean; generatedAt: number } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Connect your account at /setup first." };
  try {
    const prefs = await getPrefs();
    return { ok: true, ...await savedFriendsActivity(viewer.fid, prefs.friends, refresh) };
  } catch (error) {
    return { ok: false, error: neynarFailure(error, "Couldn't check your saved Friends accounts. Try again shortly.") };
  }
}

export async function addTopAccountsBatch(group: "network" | "leaders" | "both"): Promise<{ ok: true; prefs: Prefs; added: number; alreadySelected: number; skippedForLimit: number } | { ok: false; error: string }> {
  if (group !== "network" && group !== "leaders" && group !== "both") return { ok: false, error: "Choose a valid account group." };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Connect your account at /setup first." };
  try {
    const [snapshot, current] = await Promise.all([topAccountsSnapshot(viewer.fid), getPrefs()]);
    const network = snapshot.active.slice(0, MAX_TOP_ACCOUNTS).map(({ fid, username }) => ({ fid, username }));
    const leaders = snapshot.leaders.slice(0, MAX_TOP_ACCOUNTS).map(({ fid, username }) => ({ fid, username }));
    const requested = group === "network" ? network : group === "leaders" ? leaders : [...leaders, ...network];
    if (!requested.length) return { ok: false, error: group === "network" ? "No 90-day activity rankings are available yet. Try again after the activity scan." : "No curated Farcaster accounts could be loaded. Try again shortly." };
    const existing = new Set(current.friends.map((person) => person.fid));
    const unique = requested.filter((person, index, all) => all.findIndex((candidate) => candidate.fid === person.fid) === index);
    const alreadySelected = unique.filter((person) => existing.has(person.fid)).length;
    const additions = unique.filter((person) => !existing.has(person.fid));
    const room = Math.max(0, MAX_FRIENDS - current.friends.length);
    const accepted = additions.slice(0, room);
    const result = await savePrefs({ friends: [...current.friends, ...accepted] });
    if (!result.ok) return result;
    return { ok: true, prefs: result.prefs, added: accepted.length, alreadySelected, skippedForLimit: additions.length - accepted.length };
  } catch (error) {
    return { ok: false, error: neynarFailure(error, "Couldn't add those accounts right now. Try again shortly.") };
  }
}

export async function loadOwnMiniApps(): Promise<{ ok: true; apps: Awaited<ReturnType<typeof ownMiniApps>> } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Connect your account at /setup first." };
  try {
    return { ok: true, apps: await ownMiniApps(viewer.fid) };
  } catch (error) {
    return { ok: false, error: neynarFailure(error, "Couldn't load apps attributed to your account. Try again shortly.") };
  }
}

export async function refreshOwnMiniApps(): Promise<void> {
  if (await getViewer()) revalidateTag("own-mini-apps");
}

/** Loads the signed-in user's followed accounts only when they open custom-feed search. */
export async function loadFollowedPeople(): Promise<{ ok: true; people: { fid: number; username: string; displayName: string }[] } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Connect your account at /setup first." };
  try {
    return { ok: true, people: await getFollowedPeople() };
  } catch (error) {
    return { ok: false, error: neynarFailure(error, "Couldn't load followed accounts. You can still add someone by exact username.") };
  }
}
